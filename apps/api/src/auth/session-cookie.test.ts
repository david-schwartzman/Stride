// covers AC5 (auth-api-migration T12; ported from apps/web/src/lib/auth/cookie.test.ts)
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSessionCookie,
  readSessionCookie,
  sessionCookieName,
  setSessionCookie,
} from "./session-cookie";

// Express takes maxAge in milliseconds (Next's cookies() took seconds).
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function fakeResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() };
}

const asResponse = (res: ReturnType<typeof fakeResponse>) =>
  res as unknown as Response;
const withCookies = (cookies: Record<string, string> | undefined) =>
  ({ cookies }) as unknown as Request;

describe("session cookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is named __Host-stride_session in production, stride_session otherwise", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieName()).toBe("__Host-stride_session");

    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieName()).toBe("stride_session");
  });

  it("sets __Host-stride_session with Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = fakeResponse();

    setSessionCookie(asResponse(res), "tok");

    expect(res.cookie).toHaveBeenCalledWith("__Host-stride_session", "tok", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_MS,
    });
    // __Host- cookies must not carry a Domain.
    expect(res.cookie.mock.calls[0][2]).not.toHaveProperty("domain");
  });

  it("sets plain stride_session without Secure in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = fakeResponse();

    setSessionCookie(asResponse(res), "tok");

    expect(res.cookie).toHaveBeenCalledWith("stride_session", "tok", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_MS,
    });
  });

  it("clears with the same name and attributes", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = fakeResponse();

    clearSessionCookie(asResponse(res));

    expect(res.clearCookie).toHaveBeenCalledWith("__Host-stride_session", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("reads the token from the parsed cookies", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(readSessionCookie(withCookies({ stride_session: "tok" }))).toBe(
      "tok",
    );
  });

  it("ignores the other environment's cookie name", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      readSessionCookie(withCookies({ stride_session: "tok" })),
    ).toBeUndefined();
  });

  it("returns undefined when there is no cookie or it is empty", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(readSessionCookie(withCookies(undefined))).toBeUndefined();
    expect(readSessionCookie(withCookies({}))).toBeUndefined();
    expect(
      readSessionCookie(withCookies({ stride_session: "" })),
    ).toBeUndefined();
  });
});
