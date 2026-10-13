// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => jar }));

import {
  deleteSessionCookie,
  getSessionCookie,
  setSessionCookie,
} from "./cookie";

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

describe("session cookie", () => {
  beforeEach(() => {
    jar.set.mockReset();
    jar.get.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses __Host-stride_session with Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await setSessionCookie("tok");

    expect(jar.set).toHaveBeenCalledWith("__Host-stride_session", "tok", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_S,
    });
    // __Host- cookies must not carry a Domain.
    expect(jar.set.mock.calls[0][2]).not.toHaveProperty("domain");
  });

  it("uses plain stride_session without Secure in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await setSessionCookie("tok");

    expect(jar.set).toHaveBeenCalledWith("stride_session", "tok", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS_S,
    });
  });

  it("deletes with the same name and attributes and Max-Age=0", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await deleteSessionCookie();

    expect(jar.set).toHaveBeenCalledWith("__Host-stride_session", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });

  it("reads the token from the cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    jar.get.mockImplementation((name: string) =>
      name === "stride_session" ? { name, value: "tok" } : undefined,
    );

    expect(await getSessionCookie()).toBe("tok");
  });

  it("returns undefined when there is no cookie", async () => {
    jar.get.mockReturnValue(undefined);

    expect(await getSessionCookie()).toBeUndefined();
  });
});
