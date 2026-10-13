import { cookies } from "next/headers";

// Cookie writes only work in Server Actions and the proxy, not Server Components.

const MAX_AGE_S = 30 * 24 * 60 * 60;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

// __Host- requires Secure, Path=/ and no Domain, which plain-http localhost can't use.
export function sessionCookieName() {
  return isProduction() ? "__Host-stride_session" : "stride_session";
}

function attributes(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(sessionCookieName(), token, attributes(MAX_AGE_S));
}

export async function deleteSessionCookie(): Promise<void> {
  (await cookies()).set(sessionCookieName(), "", attributes(0));
}

export async function getSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value || undefined;
}
