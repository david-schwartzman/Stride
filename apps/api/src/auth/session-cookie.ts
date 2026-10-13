import type { CookieOptions, Request, Response } from "express";

import { SESSION_TTL_MS } from "./session.service";

// Only apps/api/src/auth/ sets or clears the session cookie; it reaches the
// browser as this API's Set-Cookie through the web's /api rewrite.

function isProduction() {
  return process.env.NODE_ENV === "production";
}

// __Host- requires Secure, Path=/ and no Domain, which plain-http localhost can't use.
export function sessionCookieName(): string {
  return isProduction() ? "__Host-stride_session" : "stride_session";
}

function attributes(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
  };
}

/** Max-Age 30 days. Express takes maxAge in milliseconds. */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(sessionCookieName(), token, {
    ...attributes(),
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionCookieName(), attributes());
}

/** The token from cookie-parser's req.cookies (registered in main.ts). */
export function readSessionCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[sessionCookieName()] || undefined;
}
