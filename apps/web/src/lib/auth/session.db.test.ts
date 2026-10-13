// @vitest-environment node
// Integration test against a real, migrated Postgres. Runs only when
// TEST_DATABASE_URL is set (CI sets it; see the signup-login spec, T12).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!url)("session (Postgres)", () => {
  let auth: typeof import("./session");
  let db: typeof import("@/lib/db").db;
  let userId: string;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    ({ db } = await import("@/lib/db"));
    auth = await import("./session");
    const user = await db.user.create({
      data: {
        email: `session-${randomUUID()}@test.stride`,
        name: "Ada",
        passwordHash: "x",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db?.user.deleteMany({ where: { id: userId } });
    await db?.$disconnect();
    vi.unstubAllEnvs();
  });

  it("stores only the token hash and validates the token", async () => {
    const token = auth.generateSessionToken();
    await auth.createSession(token, userId, {
      userAgent: "vitest",
      ipAddress: null,
    });

    const row = await db.session.findUnique({
      where: { id: auth.hashToken(token) },
    });
    expect(row?.userId).toBe(userId);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
    expect((await auth.validateSessionToken(token))?.user.id).toBe(userId);
  });

  it("rejects a copy of the token after invalidateSession (AC16)", async () => {
    const token = auth.generateSessionToken();
    await auth.createSession(token, userId, {});
    const copy = token;

    await auth.invalidateSession(token);

    expect(await auth.validateSessionToken(copy)).toBeNull();
    expect(
      await db.session.count({ where: { id: auth.hashToken(token) } }),
    ).toBe(0);
  });

  it("slides expiry to 30 days once under 15 are left, in the database", async () => {
    const token = auth.generateSessionToken();
    await auth.createSession(token, userId, {});
    const id = auth.hashToken(token);
    await db.session.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() + 10 * DAY_MS) },
    });

    const before = Date.now();
    const result = await auth.validateSessionToken(token);

    const row = await db.session.findUniqueOrThrow({ where: { id } });
    expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + auth.SESSION_TTL_MS,
    );
    expect(result?.session.expiresAt).toEqual(row.expiresAt);
  });

  it("never renews past createdAt + 90 days, in the database", async () => {
    const token = auth.generateSessionToken();
    await auth.createSession(token, userId, {});
    const id = auth.hashToken(token);
    const createdAt = new Date(Date.now() - 80 * DAY_MS);
    await db.session.update({
      where: { id },
      data: { createdAt, expiresAt: new Date(Date.now() + 5 * DAY_MS) },
    });

    await auth.validateSessionToken(token);

    const row = await db.session.findUniqueOrThrow({ where: { id } });
    expect(row.expiresAt.getTime()).toBe(
      createdAt.getTime() + auth.SESSION_MAX_AGE_MS,
    );
  });
});
