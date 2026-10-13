// @vitest-environment node
// Integration test against a real, migrated Postgres. Runs only when
// TEST_DATABASE_URL is set (CI sets it; see the signup-login spec, T12).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

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
});
