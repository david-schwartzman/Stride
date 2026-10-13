import "server-only";

import { headers } from "next/headers";

import { apiBaseUrl, missingApiEnv, trustedProxyHeaders } from "./api-proxy";

/**
 * Calls the API from a Server Component or action (AC14), with the same
 * trusted headers the `/api` proxy sends plus the shopper's Cookie. Only those
 * are copied from the incoming request: its other headers (Host,
 * Content-Length, …) describe the page request, not this one.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const missing = missingApiEnv();
  if (missing.length > 0) {
    throw new Error(`apiFetch: ${missing.join(", ")} not set`);
  }
  // A path like "@evil.com/x" or "//evil.com" would move the request — and
  // the proxy secret and the shopper's cookie — to another host.
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("apiFetch: path must start with a single /");
  }

  const outgoing = new Headers(init.headers);
  for (const [name, value] of trustedProxyHeaders(await headers())) {
    if (name.startsWith("x-stride-") || name === "cookie") {
      outgoing.set(name, value);
    }
  }
  // The API's origin check (AC8) needs an Origin on writes; a server-side
  // fetch has none, so send the shopper's web origin.
  const host = outgoing.get("x-stride-forwarded-host");
  if (host && !outgoing.has("origin")) {
    outgoing.set("origin", `https://${host}`);
  }

  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers: outgoing });
}
