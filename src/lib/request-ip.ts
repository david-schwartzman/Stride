import { isIP } from "node:net";

/**
 * The client IP from `x-real-ip`, which Vercel sets and overwrites whatever the
 * client sent. Never reads `x-forwarded-for`: its leftmost entry is
 * client-controlled. Returns null when the header is missing or not an IP
 * (local dev, tests); callers skip per-IP logic then.
 */
export function getClientIp(headers: Headers): string | null {
  const ip = headers.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : null;
}
