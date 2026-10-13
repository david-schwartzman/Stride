// @vitest-environment node
import { randomBytes } from "node:crypto";

import { MESSAGES } from "@stride/shared";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as password from "@/lib/auth/password";
import { hashToken, validateSessionToken } from "@/lib/auth/session";
import { createFakeDb, type FakeDb } from "@/lib/auth/testing/fake-db";

import type { AuthFormState } from "./form-state";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
  request: { ip: "203.0.113.7" as string | null, userAgent: "Vitest Browser" },
  onSignedIn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "user-agent": mocks.request.userAgent,
      ...(mocks.request.ip ? { "x-real-ip": mocks.request.ip } : {}),
    }),
  cookies: async () => ({
    get: (name: string) => {
      const cookie = mocks.jar.get(name);
      return cookie && { name, value: cookie.value };
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      if (options.maxAge === 0) mocks.jar.delete(name);
      else mocks.jar.set(name, { value, options });
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("./hooks", () => ({ onSignedIn: mocks.onSignedIn }));
vi.mock("@/lib/auth/password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/password")>();
  return {
    ...actual,
    verifyPassword: vi.fn(actual.verifyPassword),
    verifyDummy: vi.fn(actual.verifyDummy),
  };
});

import { loginAction, signOutAction, signupAction } from "./actions";

const PASSWORD = "correct horse battery";
const COOKIE = "stride_session";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const signup = (
  fields: Partial<Record<"name" | "email" | "password", string>> = {},
) =>
  signupAction(
    {},
    form({
      name: "Ada Lovelace",
      email: "ada@x.com",
      password: PASSWORD,
      ...fields,
    }),
  );

function expectNoSecrets(state: AuthFormState) {
  expect(JSON.stringify(state)).not.toContain(PASSWORD);
  expect(state.values).not.toHaveProperty("password");
}

beforeAll(() => {
  vi.stubEnv("PASSWORD_PEPPER", randomBytes(32).toString("base64"));
});

beforeEach(() => {
  mocks.db = createFakeDb();
  mocks.jar.clear();
  mocks.request.ip = "203.0.113.7";
  mocks.onSignedIn.mockReset();
  vi.mocked(password.verifyPassword).mockClear();
  vi.mocked(password.verifyDummy).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signupAction", () => {
  it("creates one user with a normalised email and an Argon2id hash, signs in and redirects", async () => {
    await expect(signup({ email: "  Ada@X.com " })).rejects.toThrow(
      "REDIRECT:/",
    );

    expect(mocks.db.tables.user).toHaveLength(1);
    const [user] = mocks.db.tables.user;
    expect(user).toMatchObject({ email: "ada@x.com", name: "Ada Lovelace" });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(user)).not.toContain(PASSWORD);

    const cookie = mocks.jar.get(COOKIE)!;
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    const [session] = mocks.db.tables.session;
    expect(session).toMatchObject({
      id: hashToken(cookie.value),
      userId: user.id,
      userAgent: "Vitest Browser",
      ipAddress: "203.0.113.7",
    });
  });

  it("calls onSignedIn exactly once with the new user's id", async () => {
    await expect(signup()).rejects.toThrow("REDIRECT:/");

    expect(mocks.onSignedIn).toHaveBeenCalledTimes(1);
    expect(mocks.onSignedIn).toHaveBeenCalledWith(mocks.db.tables.user[0].id);
  });

  it("still signs in when onSignedIn throws, without logging the password", async () => {
    mocks.onSignedIn.mockRejectedValue(new Error("merge failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(signup()).rejects.toThrow("REDIRECT:/");

    expect(mocks.jar.has(COOKIE)).toBe(true);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(PASSWORD);
  });

  it("refuses an existing email in any case via the unique index (P2002)", async () => {
    await expect(signup()).rejects.toThrow("REDIRECT:/");
    mocks.jar.clear();

    const state = await signup({ email: "ADA@x.com" });

    expect(state.fieldErrors).toEqual({ email: MESSAGES.emailTaken });
    expect(state.values).toEqual({ name: "Ada Lovelace", email: "ADA@x.com" });
    expect(mocks.db.tables.user).toHaveLength(1);
    expect(mocks.jar.has(COOKIE)).toBe(false);
    expectNoSecrets(state);
  });

  it("validates on the server when client validation is bypassed", async () => {
    const state = await signup({ name: "", email: "nope", password: "short" });

    expect(state.fieldErrors).toEqual({
      name: "Enter your name.",
      email: "Enter a valid email address.",
      password: "Use at least 12 characters.",
    });
    expect(mocks.db.tables.user).toHaveLength(0);
    expectNoSecrets(state);
  });

  it("refuses the 11th sign-up from one IP in an hour and creates no user", async () => {
    for (let i = 0; i < 10; i++) {
      await signup({ email: "bad" });
    }

    const state = await signup({ email: "eleventh@x.com" });

    expect(state.formError).toBe(MESSAGES.signupLimit);
    expect(mocks.db.tables.user).toHaveLength(0);
  });

  it("skips the sign-up limit when the IP is unknown", async () => {
    mocks.request.ip = null;
    for (let i = 0; i < 11; i++) await signup({ email: "bad" });

    await expect(signup({ email: "twelfth@x.com" })).rejects.toThrow(
      "REDIRECT:/",
    );
  });
});

async function addUser(email = "ada@x.com") {
  const user = await mocks.db.user.create({
    data: {
      email,
      name: "Ada Lovelace",
      passwordHash: await password.hashPassword(PASSWORD),
    },
  });
  return user.id as string;
}

const login = (email = "ada@x.com", pass = PASSWORD) =>
  loginAction({}, form({ email, password: pass }));

const keys = () => mocks.db.tables.authAttempt.map((r) => r.key).sort();

describe("loginAction", () => {
  it("signs in with a new session cookie, clears the email's failures and redirects", async () => {
    const userId = await addUser();
    await login("ada@x.com", "wrong password!!");

    await expect(login(" ADA@x.com ")).rejects.toThrow("REDIRECT:/");

    const cookie = mocks.jar.get(COOKIE)!;
    expect(mocks.db.tables.session).toEqual([
      expect.objectContaining({ id: hashToken(cookie.value), userId }),
    ]);
    expect(keys()).toEqual(["ip:203.0.113.7"]);
    expect(mocks.onSignedIn).toHaveBeenCalledTimes(1);
    expect(mocks.onSignedIn).toHaveBeenCalledWith(userId);
  });

  it("creates a new token on every login and ends the session the request came with", async () => {
    await addUser();
    await expect(login()).rejects.toThrow("REDIRECT:/");
    const first = mocks.jar.get(COOKIE)!.value;

    await expect(login()).rejects.toThrow("REDIRECT:/");
    const second = mocks.jar.get(COOKIE)!.value;

    expect(second).not.toBe(first);
    expect(mocks.db.tables.session.map((s) => s.id)).toEqual([
      hashToken(second),
    ]);
    expect(await validateSessionToken(first)).toBeNull();
  });

  it("signing up while signed in ends the previous session too", async () => {
    await addUser();
    await expect(login()).rejects.toThrow("REDIRECT:/");
    const before = mocks.jar.get(COOKIE)!.value;

    await expect(signup({ email: "new@x.com" })).rejects.toThrow("REDIRECT:/");

    expect(await validateSessionToken(before)).toBeNull();
    expect(mocks.db.tables.session).toHaveLength(1);
  });

  it("still signs in when onSignedIn throws", async () => {
    await addUser();
    mocks.onSignedIn.mockRejectedValue(new Error("merge failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(login()).rejects.toThrow("REDIRECT:/");
    expect(mocks.jar.has(COOKIE)).toBe(true);
  });

  it("rejects a wrong password on the Password field, records a failure and sets no cookie", async () => {
    await addUser();

    const state = await login("ada@x.com", "wrong password!!");

    expect(state).toEqual({
      fieldErrors: { password: MESSAGES.wrongPassword },
      values: { email: "ada@x.com" },
    });
    expect(mocks.jar.has(COOKIE)).toBe(false);
    expect(keys()).toEqual(["email:ada@x.com", "ip:203.0.113.7"]);
    expectNoSecrets(state);
  });

  it("treats an unknown email like a wrong password, using the dummy hash", async () => {
    const state = await login("nobody@x.com");

    expect(state.fieldErrors).toEqual({ password: MESSAGES.wrongPassword });
    expect(password.verifyDummy).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual(["email:nobody@x.com", "ip:203.0.113.7"]);
    expect(mocks.jar.has(COOKIE)).toBe(false);
    expectNoSecrets(state);
  });

  it("throttles an unknown email after 5 failures, like a real one", async () => {
    for (let i = 0; i < 5; i++) await login("nobody@x.com");

    const state = await login("nobody@x.com");

    expect(state.formError).toBe(MESSAGES.tooManyAttempts(1));
    expect(state.formError).toBe("Too many attempts, try again in 1 minute.");
  });

  it("refuses ` A@X.com ` after 5 wrong passwords as `a@x.com`, without checking the password", async () => {
    await addUser("a@x.com");
    for (let i = 0; i < 5; i++) await login("a@x.com", "wrong password!!");
    vi.mocked(password.verifyPassword).mockClear();
    const before = mocks.db.tables.authAttempt.length;

    const state = await login(" A@X.com ", PASSWORD);

    expect(state.formError).toBe(MESSAGES.tooManyAttempts(1));
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.db.tables.authAttempt).toHaveLength(before);
    expect(mocks.jar.has(COOKIE)).toBe(false);
  });

  it("validates on the server before throttling or looking anything up", async () => {
    const state = await login("nope", "short");

    expect(state.fieldErrors).toEqual({
      email: "Enter a valid email address.",
      password: "Use at least 12 characters.",
    });
    expect(mocks.db.tables.authAttempt).toHaveLength(0);
    expect(password.verifyDummy).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  it("deletes the session row, clears the cookie and redirects; the old token stops working", async () => {
    await addUser();
    await expect(login()).rejects.toThrow("REDIRECT:/");
    const token = mocks.jar.get(COOKIE)!.value;

    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");

    expect(mocks.db.tables.session).toHaveLength(0);
    expect(mocks.jar.has(COOKIE)).toBe(false);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("redirects when there is no session", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
  });
});

describe("throttling under concurrency", () => {
  it("parallel wrong-password logins for one email get at most 5 password checks", async () => {
    await addUser();

    const results = await Promise.all(
      Array.from({ length: 12 }, () => login("ada@x.com", "wrong password!!")),
    );

    expect(
      vi.mocked(password.verifyPassword).mock.calls.length,
    ).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.formError).length).toBeGreaterThanOrEqual(7);
  });

  it("parallel sign-ups from one IP create at most 10 users", async () => {
    await Promise.allSettled(
      Array.from({ length: 15 }, (_, i) => signup({ email: `user${i}@x.com` })),
    );

    expect(mocks.db.tables.user.length).toBeLessThanOrEqual(10);
  });
});
