import "server-only";

import { headers } from "next/headers";

import { apiBaseUrl, trustedProxyHeaders } from "./api-proxy";

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
  const base = apiBaseUrl();
  if (!base) throw new Error("API_URL is not set");

  const outgoing = new Headers(init.headers);
  for (const [name, value] of trustedProxyHeaders(await headers())) {
    if (name.startsWith("x-stride-") || name === "cookie") {
      outgoing.set(name, value);
    }
  }
  return fetch(`${base}${path}`, { ...init, headers: outgoing });
}
