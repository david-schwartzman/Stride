// covers AC7 (auth-api-migration T5)
// A probe route behind AuthGuard, served over real HTTP with the fake DB, so
// cookie parsing, 401 bodies and the renewal Set-Cookie are exercised end to end.
// GET /auth/me itself is asserted in auth.controller.test.ts (T4).
import {
  Controller,
  Get,
  type INestApplication,
  UseGuards,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { meResponseSchema } from "@stride/shared";
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
import { AuthGuard } from "./auth.guard";
import { CurrentUser } from "./current-user.decorator";
import {
  SessionService,
  generateSessionToken,
  hashToken,
  type SessionUser,
} from "./session.service";
import { createFakeDb, type FakeDb } from "./testing/fake-db";

@Controller("probe")
class ProbeController {
  @Get()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser) {
    return user;
  }
}

const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2026-10-01T12:00:00Z").getTime();
const USER = {
  id: "user_1",
  email: "ada@x.com",
  name: "Ada",
  passwordHash: "$argon2id$secret-hash",
};

const fake = { db: createFakeDb() };
let app: INestApplication;
let baseUrl: string;
let sessions: SessionService;

function at(ms: number) {
  vi.setSystemTime(START + ms);
}

async function signedIn() {
  const token = generateSessionToken();
  await sessions.createSession(token, USER.id, {});
  return token;
}

function probe(cookie?: string) {
  return fetch(`${baseUrl}/probe`, {
    headers: cookie ? { cookie } : {},
  });
}

async function expect401(res: Response) {
  expect(res.status).toBe(401);
  expect(res.headers.get("set-cookie")).toBeNull();
  const body = await res.text();
  for (const leak of [USER.id, USER.email, USER.name, USER.passwordHash]) {
    expect(body).not.toContain(leak);
  }
}

describe("AuthGuard", () => {
  beforeAll(async () => {
    // A proxy, so each test can swap in a fresh fake DB behind the same app.
    const db = new Proxy({} as FakeDb, {
      get: (_, key) => fake.db[key as keyof FakeDb],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        AuthGuard,
        SessionService,
        { provide: PrismaService, useValue: db },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    sessions = app.get(SessionService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    fake.db = createFakeDb();
    fake.db.tables.user.push({ ...USER });
    // Only Date: the HTTP server needs real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets a valid cookie through and gives the handler only {id, email, name}", async () => {
    const token = await signedIn();

    const res = await probe(`stride_session=${token}`);

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).toEqual({ id: USER.id, email: USER.email, name: USER.name });
    expect(meResponseSchema.strict().parse(body)).toEqual(body);
  });

  it("doesn't re-set the cookie when the session wasn't renewed", async () => {
    const token = await signedIn();
    at(14 * DAY);

    const res = await probe(`stride_session=${token}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers 401 without user data when there is no cookie", async () => {
    await signedIn();

    await expect401(await probe());
  });

  it("answers 401 for an empty cookie", async () => {
    await expect401(await probe("stride_session="));
  });

  it("answers 401 for an expired session and deletes its row", async () => {
    const token = await signedIn();
    at(30 * DAY);

    await expect401(await probe(`stride_session=${token}`));
    expect(fake.db.tables.session).toHaveLength(0);
  });

  it("answers 401 for a revoked session", async () => {
    const token = await signedIn();
    await sessions.invalidateSession(token);

    await expect401(await probe(`stride_session=${token}`));
  });

  it("answers 401 for a tampered token", async () => {
    const token = await signedIn();
    const tampered = (token[0] === "a" ? "b" : "a") + token.slice(1);

    await expect401(await probe(`stride_session=${tampered}`));
  });

  it("answers 401 for the token's hash (the stored id) used as a cookie", async () => {
    const token = await signedIn();

    await expect401(await probe(`stride_session=${hashToken(token)}`));
  });

  it("re-sets the cookie with a fresh 30-day Max-Age when it renews the session", async () => {
    const token = await signedIn();
    at(16 * DAY);

    const res = await probe(`stride_session=${token}`);

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toMatch(new RegExp(`^stride_session=${token};`));
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toMatch(/Domain=/i);
    expect(fake.db.tables.session[0].expiresAt).toEqual(
      new Date(START + 46 * DAY),
    );
  });

  it("never renews past 90 days from sign-in, then answers 401", async () => {
    const token = await signedIn();
    // Visit every 16 days: each visit renews, until the 90-day cap.
    for (let day = 16; day < 90; day += 16) {
      at(day * DAY);
      expect((await probe(`stride_session=${token}`)).status).toBe(200);
    }
    expect(fake.db.tables.session[0].expiresAt).toEqual(
      new Date(START + 90 * DAY),
    );

    at(90 * DAY);
    await expect401(await probe(`stride_session=${token}`));
  });
});
