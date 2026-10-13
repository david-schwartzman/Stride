// @vitest-environment node
import { randomBytes } from "node:crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { hashToken } from "@/lib/auth/session";
import { createFakeDb, type FakeDb } from "@/lib/auth/testing/fake-db";

import { MESSAGES, type AuthFormState } from "./form-state";

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

import { signupAction } from "./actions";

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
