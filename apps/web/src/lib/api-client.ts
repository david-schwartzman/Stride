import "server-only";

import { headers } from "next/headers";

import {
  addProtectionBypass,
  apiBaseUrl,
  missingApiEnv,
  trustedProxyHeaders,
} from "./api-proxy";

/** Applied when the caller passes no `signal`, so a hung API can't hang the page. */
export const API_FETCH_TIMEOUT_MS = 10_000;

/**
 * Calls the API from a Server Component or action (AC14), with the same
 * trusted headers the `/api` proxy sends plus the shopper's Cookie. Only those
 * are copied from the incoming request: its other headers (Host,
 * Content-Length, …) describe the page request, not this one.
 *
 * - Caller-supplied `x-stride-*` headers are dropped: only the trusted ones are sent.
 * - `Origin` is the incoming request's own, or absent. It's never invented, so
 *   a write without a real browser Origin fails the API's check (AC8).
 * - Without a caller `signal`, the call times out after 10 seconds.
 * - On Preview it adds `x-vercel-protection-bypass`, like the proxy (AC12).
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

  const incoming = await headers();
  const outgoing = new Headers(init.headers);
  for (const name of [...outgoing.keys()]) {
    if (name.startsWith("x-stride-")) outgoing.delete(name);
  }
  for (const [name, value] of trustedProxyHeaders(incoming)) {
    if (name.startsWith("x-stride-") || name === "cookie") {
      outgoing.set(name, value);
    }
  }
  outgoing.delete("origin");
  const origin = incoming.get("origin");
  if (origin) outgoing.set("origin", origin);
  addProtectionBypass(outgoing);

  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: outgoing,
    signal: init.signal ?? AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
  });
}
