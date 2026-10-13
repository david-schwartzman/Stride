import { NextResponse, type NextRequest } from "next/server";

import { getClientIp } from "./request-ip";

const LOCAL_API_URL = "http://localhost:4000";

/**
 * The headers the API trusts (AC14), built from the incoming request. Any
 * client-sent `x-stride-*` header is dropped first so a browser can't spoof
 * one; the API only believes them because the proxy secret comes with them.
 */
export function trustedProxyHeaders(incoming: Headers): Headers {
  const headers = new Headers(incoming);
  for (const name of [...headers.keys()]) {
    if (name.startsWith("x-stride-")) headers.delete(name);
  }

  const secret = process.env.WEB_PROXY_SECRET;
  if (secret) headers.set("x-stride-proxy-secret", secret);
  const ip = getClientIp(incoming);
  if (ip) headers.set("x-stride-client-ip", ip);
  const host = incoming.get("host");
  if (host) headers.set("x-stride-forwarded-host", host);
  return headers;
}

/** The API's base URL: `API_URL`, or the local API outside production. */
export function apiBaseUrl(): string | null {
  const url =
    process.env.API_URL ||
    (process.env.NODE_ENV === "production" ? null : LOCAL_API_URL);
  return url ? url.replace(/\/$/, "") : null;
}

/**
 * Same-origin `/api/*` → the API (AC4): strips `/api`, keeps the query and
 * passes the whole request (Cookie included) with the trusted headers.
 */
export function apiRewrite(request: NextRequest): NextResponse {
  const base = apiBaseUrl();
  const secret = process.env.WEB_PROXY_SECRET;
  if (process.env.NODE_ENV === "production" && (!base || !secret)) {
    // Name the variable, never its value.
    const missing = [!base && "API_URL", !secret && "WEB_PROXY_SECRET"];
    console.error(
      `API proxy disabled: ${missing.filter(Boolean).join(", ")} not set`,
    );
    return new NextResponse(null, { status: 503 });
  }

  const { pathname, search } = request.nextUrl;
  const path = pathname.slice("/api".length) || "/";
  const headers = trustedProxyHeaders(request.headers);
  const bypass = process.env.API_PROTECTION_BYPASS_SECRET;
  if (process.env.VERCEL_ENV === "preview" && bypass) {
    headers.set("x-vercel-protection-bypass", bypass);
  }

  return NextResponse.rewrite(`${base}${path}${search}`, {
    request: { headers },
  });
}
