import { getClientIp } from "@/lib/request-ip";

import { setSessionCookie } from "./cookie";
import { createSession, generateSessionToken } from "./session";

/**
 * Signs a user in: always a brand-new token (never one that came with the
 * request), its hash stored as the Session, the raw token only in the cookie.
 * Server Actions only — it sets a cookie.
 */
export async function startSession(
  userId: string,
  requestHeaders: Headers,
): Promise<void> {
  const token = generateSessionToken();
  await createSession(token, userId, {
    userAgent: requestHeaders.get("user-agent"),
    ipAddress: getClientIp(requestHeaders),
  });
  await setSessionCookie(token);
}
