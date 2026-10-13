import { cache } from "react";

import { getSessionCookie } from "./cookie";
import { validateSessionToken, type SessionValidationResult } from "./session";

/**
 * The signed-in session and user for this request, or null. Validated once per
 * request. Everything outside src/lib/auth/ reads the session through this.
 */
export const getCurrentSession = cache(
  async (): Promise<SessionValidationResult> => {
    const token = await getSessionCookie();
    if (!token) return null;
    return validateSessionToken(token);
  },
);
