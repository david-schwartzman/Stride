import { getClientIp } from "@/lib/request-ip";

import {
  deleteSessionCookie,
  getSessionCookie,
  setSessionCookie,
} from "./cookie";
import {
  createSession,
  generateSessionToken,
  invalidateSession,
} from "./session";

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

/** Signs the current request's session out: deletes its row, then the cookie. */
export async function endSession(): Promise<void> {
  const token = await getSessionCookie();
  if (token) await invalidateSession(token);
  await deleteSessionCookie();
}
