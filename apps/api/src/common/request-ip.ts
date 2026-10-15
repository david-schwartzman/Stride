import { isIP } from "node:net";

import type { Request } from "express";

/**
 * The shopper's IP, as the web proxy saw it (AC9). Trusted only because
 * ProxySecretMiddleware runs first. Never reads `x-forwarded-for`, `x-real-ip`
 * or the socket: across the rewrite those are the web's shared egress IP.
 * Null means unknown: callers skip per-IP logic (fail open), never share one
 * bucket.
 */
export function getClientIp(req: Request): string | null {
  const ip = req.headers["x-stride-client-ip"];
  if (typeof ip !== "string") return null;
  const trimmed = ip.trim();
  return isIP(trimmed) ? trimmed : null;
}
