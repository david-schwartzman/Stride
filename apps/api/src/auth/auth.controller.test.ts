// covers AC2–AC7, AC13 (auth-api-migration T4; replaces apps/web/src/features/auth/actions.test.ts)
// The real AuthController, guard and services over HTTP, with the fake DB.
import { randomBytes } from "node:crypto";

import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import {
  MESSAGES,
  authErrorSchema,
  authSuccessSchema,
  meResponseSchema,
} from "@stride/shared";
import cookieParser from "cookie-parser";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { useSafeBodyParsing } from "./body-parsing";
import { signInHooks } from "./on-signed-in";
import * as password from "./password.service";
import { SessionService, hashToken } from "./session.service";
import { createFakeDb, type FakeDb } from "./testing/fake-db";
import { ThrottleService } from "./throttle.service";

vi.mock("./password.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./password.service")>();
  return {
    ...actual,
    verifyPassword: vi.fn(actual.verifyPassword),
    verifyDummy: vi.fn(actual.verifyDummy),
  };
});

const PASSWORD = "correct horse battery";
const IP = "203.0.113.7";
const COOKIE = "stride_session";

const PEPPER = randomBytes(32).toString("base64");

const fake = { db: createFakeDb() };
const request = { ip: IP as string | null };
let app: NestExpressApplication;
let baseUrl: string;
let sessions: SessionService;
let logs: unknown[][];

type Options = { cookie?: string; ip?: string | null };

function headers({ cookie, ip = request.ip }: Options) {
  return {
    "user-agent": "Vitest Browser",
    ...(ip ? { "x-stride-client-ip": ip } : {}),
    ...(cookie ? { cookie } : {}),
  };
}

function post(path: string, body: unknown, options: Options = {}) {
  return fetch(`${baseUrl}/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers(options) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

const signup = (
  fields: Partial<Record<"name" | "email" | "password", string>> = {},
  options?: Options,
) =>
  post(
    "signup",
    { name: "Ada Lovelace", email: "ada@x.com", password: PASSWORD, ...fields },
    options,
  );

const login = (email = "ada@x.com", pass = PASSWORD, options?: Options) =>
  post("login", { email, password: pass }, options);

const logout = (cookie?: string) =>
  fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: headers({ cookie }),
    redirect: "manual",
  });

const me = (cookie?: string) =>
  fetch(`${baseUrl}/auth/me`, { headers: headers({ cookie }) });

/** The session token the response sets, or undefined. */
function tokenFrom(res: Response, name = COOKIE): string | undefined {
  const cookie = res.headers.get("set-cookie");
  return cookie?.match(new RegExp(`^${name}=([^;]+);`))?.[1];
}

/** Checks the status and that the body never carries the password or a token. */
async function bodyOf(res: Response, status: number) {
  const text = await res.text();
  expect(res.status, text).toBe(status);
  expect(text).not.toContain(PASSWORD);
  const token = tokenFrom(res);
  if (token) expect(text).not.toContain(token);
  return JSON.parse(text) as unknown;
}

async function expectSignedIn(res: Response) {
  const body = await bodyOf(res, 200);
  expect(body).toEqual({ redirectTo: "/" });
  expect(authSuccessSchema.strict().parse(body)).toEqual(body);
  const token = tokenFrom(res);
  expect(token).toBeDefined();
  return token!;
}

async function expectError(res: Response, status: number) {
  const body = await bodyOf(res, status);
  expect(authErrorSchema.strict().parse(body)).toEqual(body);
  expect(res.headers.get("set-cookie")).toBeNull();
  return body;
}

async function addUser(email = "ada@x.com") {
  const user = await fake.db.user.create({
    data: {
      email,
      name: "Ada Lovelace",
      passwordHash: await password.hashPassword(PASSWORD),
    },
  });
  return user.id as string;
}

const keys = () => fake.db.tables.authAttempt.map((r) => r.key).sort();

beforeAll(async () => {
  // A proxy, so each test can swap in a fresh fake DB behind the same app.
  const db = new Proxy({} as FakeDb, {
    get: (_, key) => fake.db[key as keyof FakeDb],
  });
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      AuthGuard,
      SessionService,
      ThrottleService,
      { provide: PrismaService, useValue: db },
    ],
  }).compile();
  // As main.ts sets it up.
  app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
    bodyParser: false,
  });
  useSafeBodyParsing(app);
  app.use(cookieParser());
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  sessions = app.get(SessionService);
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  vi.stubEnv("PASSWORD_PEPPER", PEPPER);
  fake.db = createFakeDb();
  request.ip = IP;
  vi.mocked(password.verifyPassword).mockClear();
  vi.mocked(password.verifyDummy).mockClear();
  logs = [];
  for (const level of ["log", "error", "warn", "debug", "verbose"] as const) {
    vi.spyOn(Logger.prototype, level).mockImplementation((...args) => {
      logs.push(args);
    });
  }
  for (const level of ["log", "error", "warn", "info"] as const) {
    vi.spyOn(console, level).mockImplementation((...args) => {
      logs.push(args);
    });
  }
});

afterEach(() => {
  // AC13: nothing logged ever holds the password.
  expect(JSON.stringify(logs)).not.toContain(PASSWORD);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /auth/signup", () => {
  it("creates one user with a normalised email and an Argon2id hash, signs in and answers 200", async () => {
    const token = await expectSignedIn(await signup({ email: "  Ada@X.com " }));

    expect(fake.db.tables.user).toHaveLength(1);
    const [user] = fake.db.tables.user;
    expect(user).toMatchObject({ email: "ada@x.com", name: "Ada Lovelace" });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(user)).not.toContain(PASSWORD);
    expect(fake.db.tables.session).toEqual([
      expect.objectContaining({
        id: hashToken(token),
        userId: user.id,
        userAgent: "Vitest Browser",
        ipAddress: IP,
      }),
    ]);
  });

  it("calls onSignedIn exactly once with the new user's id", async () => {
    const hook = vi.spyOn(signInHooks, "onSignedIn");

    await expectSignedIn(await signup());

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(fake.db.tables.user[0].id);
  });

  it("still signs in when onSignedIn throws, logging neither the password nor the token", async () => {
    vi.spyOn(signInHooks, "onSignedIn").mockRejectedValue(
      new Error("merge failed"),
    );

    const token = await expectSignedIn(await signup());

    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain(token);
  });

  it("ends the session the request came with", async () => {
    await addUser();
    const before = await expectSignedIn(await login());

    await expectSignedIn(
      await signup({ email: "new@x.com" }, { cookie: `${COOKIE}=${before}` }),
    );

    expect(await sessions.validateSessionToken(before)).toBeNull();
    expect(fake.db.tables.session).toHaveLength(1);
  });

  it("answers 409 for an existing email in any case and creates no user", async () => {
    await expectSignedIn(await signup());

    const body = await expectError(await signup({ email: "ADA@x.com" }), 409);

    expect(body).toEqual({ fieldErrors: { email: MESSAGES.emailTaken } });
    expect(fake.db.tables.user).toHaveLength(1);
  });

  it("answers 400 fieldErrors when client validation is bypassed", async () => {
    const body = await expectError(
      await signup({ name: "", email: "nope", password: "short" }),
      400,
    );

    expect(body).toEqual({
      fieldErrors: {
        name: "Enter your name.",
        email: "Enter a valid email address.",
        password: "Use at least 12 characters.",
      },
    });
    expect(fake.db.tables.user).toHaveLength(0);
  });

  it("answers 429 to the 11th sign-up from one IP, before validation, and creates no user", async () => {
    for (let i = 0; i < 10; i++) {
      await expectError(await signup({ email: "bad" }), 400);
    }

    const body = await expectError(await signup({ email: "bad" }), 429);

    expect(body).toEqual({ formError: MESSAGES.signupLimit });
    await expectError(await signup({ email: "eleventh@x.com" }), 429);
    expect(fake.db.tables.user).toHaveLength(0);
  });

  it("skips the sign-up limit when the IP is unknown", async () => {
    request.ip = null;
    for (let i = 0; i < 11; i++) await signup({ email: "bad" });

    await expectSignedIn(await signup({ email: "twelfth@x.com" }));
    expect(keys()).toEqual([]);
  });
});

describe("POST /auth/login", () => {
  it("signs in with a new session cookie, clears the email's failures and calls onSignedIn", async () => {
    const userId = await addUser();
    await login("ada@x.com", "wrong password!!");
    const hook = vi.spyOn(signInHooks, "onSignedIn");

    const token = await expectSignedIn(await login(" ADA@x.com "));

    expect(fake.db.tables.session).toEqual([
      expect.objectContaining({ id: hashToken(token), userId }),
    ]);
    expect(keys()).toEqual([`ip:${IP}`]);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(userId);
  });

  it("issues a new token on every login and ends the session the request came with", async () => {
    await addUser();
    const first = await expectSignedIn(await login());

    const second = await expectSignedIn(
      await login(undefined, undefined, { cookie: `${COOKIE}=${first}` }),
    );

    expect(second).not.toBe(first);
    expect(fake.db.tables.session.map((s) => s.id)).toEqual([
      hashToken(second),
    ]);
    expect(await sessions.validateSessionToken(first)).toBeNull();
  });

  it("still signs in when onSignedIn throws", async () => {
    await addUser();
    vi.spyOn(signInHooks, "onSignedIn").mockRejectedValue(
      new Error("merge failed"),
    );

    await expectSignedIn(await login());
  });

  it("answers 401 on the Password field for a wrong password, records a failure and sets no cookie", async () => {
    await addUser();

    const body = await expectError(
      await login("ada@x.com", "wrong password!!"),
      401,
    );

    expect(body).toEqual({ fieldErrors: { password: MESSAGES.wrongPassword } });
    expect(keys()).toEqual(["email:ada@x.com", `ip:${IP}`]);
    expect(fake.db.tables.session).toHaveLength(0);
  });

  it("treats an unknown email like a wrong password, using the dummy hash", async () => {
    const body = await expectError(await login("nobody@x.com"), 401);

    expect(body).toEqual({ fieldErrors: { password: MESSAGES.wrongPassword } });
    expect(password.verifyDummy).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual(["email:nobody@x.com", `ip:${IP}`]);
  });

  it("answers 429 with the back-off message after 5 failures, even for an unknown email", async () => {
    for (let i = 0; i < 5; i++) await login("nobody@x.com");

    const body = await expectError(await login("nobody@x.com"), 429);

    expect(body).toEqual({
      formError: "Too many attempts, try again in 1 minute.",
    });
  });

  it("refuses ` A@X.com ` after 5 wrong passwords as `a@x.com`, without checking the password", async () => {
    await addUser("a@x.com");
    for (let i = 0; i < 5; i++) await login("a@x.com", "wrong password!!");
    vi.mocked(password.verifyPassword).mockClear();
    const before = fake.db.tables.authAttempt.length;

    const body = await expectError(await login(" A@X.com ", PASSWORD), 429);

    expect(body).toEqual({ formError: MESSAGES.tooManyAttempts(1) });
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(fake.db.tables.authAttempt).toHaveLength(before);
  });

  it("answers 400 fieldErrors before throttling or looking anything up", async () => {
    const body = await expectError(await login("nope", "short"), 400);

    expect(body).toEqual({
      fieldErrors: {
        email: "Enter a valid email address.",
        password: "Use at least 12 characters.",
      },
    });
    expect(fake.db.tables.authAttempt).toHaveLength(0);
    expect(password.verifyDummy).not.toHaveBeenCalled();
  });

  it("skips the per-IP limits when the IP is unknown, never sharing one bucket", async () => {
    request.ip = null;

    await expectError(await login("nobody@x.com"), 401);

    expect(keys()).toEqual(["email:nobody@x.com"]);
  });
});

describe("POST /auth/logout", () => {
  it("deletes the session, clears the cookie and answers 303 to /; the old token stops working", async () => {
    await addUser();
    const token = await expectSignedIn(await login());

    const res = await logout(`${COOKIE}=${token}`);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.get("set-cookie")).toMatch(
      /^stride_session=; Path=\/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax$/,
    );
    expect(fake.db.tables.session).toHaveLength(0);
    expect((await me(`${COOKIE}=${token}`)).status).toBe(401);
  });

  it("works as a plain HTML form POST", async () => {
    await addUser();
    const token = await expectSignedIn(await login());

    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${COOKIE}=${token}`,
      },
      body: "",
      redirect: "manual",
    });

    expect(res.status).toBe(303);
    expect(fake.db.tables.session).toHaveLength(0);
  });

  it("answers 303 to / when there is no session", async () => {
    const res = await logout();

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });

  it("has no GET logout", async () => {
    expect((await fetch(`${baseUrl}/auth/logout`)).status).toBe(404);
  });
});

describe("malformed JSON bodies (security review T30 #1)", () => {
  function raw(path: string, body: string) {
    return fetch(`${baseUrl}/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers({}) },
      body,
    });
  }

  it.each([
    [
      "login",
      {
        email: "Enter a valid email address.",
        password: "Use at least 12 characters.",
      },
    ],
    [
      "signup",
      {
        name: "Enter your name.",
        email: "Enter a valid email address.",
        password: "Use at least 12 characters.",
      },
    ],
  ])(
    "answers /auth/%s with the empty form's field errors, never echoing the body",
    async (path, fieldErrors) => {
      const secret = "hunter2-secret-value";

      const res = await raw(path, `{"email":"a@b.c","password":${secret}}`);

      const text = await res.text();
      expect(res.status, text).toBe(400);
      expect(text).not.toContain("hunter2");
      expect(text).not.toContain("a@b.c");
      expect(JSON.parse(text)).toEqual({ fieldErrors });
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(JSON.stringify(logs)).not.toContain("hunter2");
    },
  );

  it("answers other routes with a generic 400 that quotes nothing", async () => {
    const res = await raw("logout", '{"token":hunter2-secret-value}');

    const text = await res.text();
    expect(res.status, text).toBe(400);
    expect(text).not.toContain("hunter2");
    expect(JSON.parse(text)).toEqual({
      statusCode: 400,
      message: "Invalid request body.",
    });
  });
});

describe("GET /auth/me", () => {
  it("is never cached (security review T30 #3)", async () => {
    await addUser();
    const token = await expectSignedIn(await login());

    for (const cookie of [`${COOKIE}=${token}`, undefined]) {
      expect((await me(cookie)).headers.get("cache-control")).toBe(
        "private, no-store",
      );
    }
  });

  it("returns only { id, email, name } for a valid cookie", async () => {
    const userId = await addUser();
    const token = await expectSignedIn(await login());

    const res = await me(`${COOKIE}=${token}`);

    const body = await bodyOf(res, 200);
    expect(body).toEqual({
      id: userId,
      email: "ada@x.com",
      name: "Ada Lovelace",
    });
    expect(meResponseSchema.strict().parse(body)).toEqual(body);
  });

  it("answers 401 without user data when signed out", async () => {
    await addUser();

    const res = await me();

    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("ada@x.com");
  });
});

describe("Set-Cookie attributes (AC5)", () => {
  it("is stride_session, HttpOnly, SameSite=Lax, Path=/, 30 days, no Domain and no Secure outside production", async () => {
    await addUser();

    const res = await login();

    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^stride_session=[a-z2-7]{52}; /);
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toContain("Secure");
  });

  it("is __Host-stride_session with Secure in production, and reads that name back", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await addUser();

    const res = await login();

    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^__Host-stride_session=[a-z2-7]{52}; /);
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toMatch(/Domain=/i);

    const token = tokenFrom(res, "__Host-stride_session")!;
    expect((await me(`__Host-stride_session=${token}`)).status).toBe(200);
    expect((await me(`${COOKIE}=${token}`)).status).toBe(401);
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
    expect(
      results.filter((r) => r.status === 429).length,
    ).toBeGreaterThanOrEqual(7);
  });

  it("parallel sign-ups from one IP create at most 10 users", async () => {
    await Promise.all(
      Array.from({ length: 15 }, (_, i) => signup({ email: `user${i}@x.com` })),
    );

    expect(fake.db.tables.user.length).toBeLessThanOrEqual(10);
  });
});
