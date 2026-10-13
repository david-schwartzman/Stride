// covers AC3, AC7, AC14 (auth-api-migration T2; ported from apps/web/src/lib/auth/session.test.ts)
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import {
  SessionService,
  generateSessionToken,
  hashToken,
} from "./session.service";
import { createFakeDb, type FakeDb } from "./testing/fake-db";

const fake = { db: undefined as unknown as FakeDb };
let sessions: SessionService;

const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2026-10-01T12:00:00Z");

function addUser(id = "user_1") {
  fake.db.tables.user.push({
    id,
    email: `${id}@x.com`,
    name: "Ada",
    passwordHash: "h",
  });
  return id;
}

function at(ms: number) {
  vi.setSystemTime(START.getTime() + ms);
}

describe("session", () => {
  beforeEach(() => {
    fake.db = createFakeDb();
    sessions = new SessionService(fake.db as unknown as PrismaService);
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates a fresh 256-bit token each time", () => {
    const token = generateSessionToken();

    // 32 bytes → 52 base32 characters, no padding.
    expect(token).toMatch(/^[a-z2-7]{52}$/);
    expect(generateSessionToken()).not.toBe(token);
  });

  it("hashes a token to hex sha256", () => {
    expect(hashToken("abc")).toBe(
      createHash("sha256").update("abc").digest("hex"),
    );
  });

  it("creates a session stored under the token hash only", async () => {
    const userId = addUser();
    const token = generateSessionToken();

    const session = await sessions.createSession(token, userId, {
      userAgent: "Firefox",
      ipAddress: "203.0.113.7",
    });

    expect(session.id).toBe(hashToken(token));
    expect(session.expiresAt).toEqual(new Date(START.getTime() + 30 * DAY));
    const [row] = fake.db.tables.session;
    expect(row).toMatchObject({
      id: hashToken(token),
      userId,
      userAgent: "Firefox",
      ipAddress: "203.0.113.7",
    });
    expect(JSON.stringify(fake.db.tables.session)).not.toContain(token);
  });

  it("validates a token and returns the session with its user", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, userId, {});

    const result = await sessions.validateSessionToken(token);

    expect(result?.session.id).toBe(hashToken(token));
    expect(result?.user).toEqual({
      id: userId,
      email: "user_1@x.com",
      name: "Ada",
    });
  });

  it("returns null for an unknown token", async () => {
    expect(
      await sessions.validateSessionToken(generateSessionToken()),
    ).toBeNull();
  });

  it("doesn't renew while more than 15 days are left", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, userId, {});

    at(14 * DAY);
    const result = await sessions.validateSessionToken(token);

    expect(result?.session.expiresAt).toEqual(
      new Date(START.getTime() + 30 * DAY),
    );
    expect(result?.renewed).toBe(false);
  });

  it("slides expiry to now + 30 days once fewer than 15 days are left", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, userId, {});

    at(16 * DAY);
    const result = await sessions.validateSessionToken(token);

    const expected = new Date(START.getTime() + 46 * DAY);
    expect(result?.session.expiresAt).toEqual(expected);
    expect(fake.db.tables.session[0].expiresAt).toEqual(expected);
    expect(result?.renewed).toBe(true);
  });

  it("never renews beyond createdAt + 90 days", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, userId, {});

    // Keep the session alive with a request every 16 days.
    for (const day of [16, 32, 48, 64, 80]) {
      at(day * DAY);
      expect(await sessions.validateSessionToken(token)).not.toBeNull();
    }

    const cap = new Date(START.getTime() + 90 * DAY);
    expect(fake.db.tables.session[0].expiresAt).toEqual(cap);

    at(90 * DAY);
    expect(await sessions.validateSessionToken(token)).toBeNull();
  });

  it("treats an expired session as logged out and deletes its row", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, userId, {});

    at(30 * DAY);

    expect(await sessions.validateSessionToken(token)).toBeNull();
    expect(fake.db.tables.session).toHaveLength(0);
  });

  it("invalidateSession deletes the row, and the old token is rejected (AC16)", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, userId, {});

    await sessions.invalidateSession(token);

    expect(fake.db.tables.session).toHaveLength(0);
    expect(await sessions.validateSessionToken(token)).toBeNull();
  });

  it("invalidateAllSessions removes only that user's sessions", async () => {
    const ada = addUser("ada");
    const bob = addUser("bob");
    const adaPhone = generateSessionToken();
    const adaLaptop = generateSessionToken();
    const bobToken = generateSessionToken();
    await sessions.createSession(adaPhone, ada, {});
    await sessions.createSession(adaLaptop, ada, {});
    await sessions.createSession(bobToken, bob, {});

    await sessions.invalidateAllSessions(ada);

    expect(await sessions.validateSessionToken(adaPhone)).toBeNull();
    expect(await sessions.validateSessionToken(adaLaptop)).toBeNull();
    expect(await sessions.validateSessionToken(bobToken)).not.toBeNull();
  });
});

describe("session renewal race", () => {
  beforeEach(() => {
    fake.db = createFakeDb();
    sessions = new SessionService(fake.db as unknown as PrismaService);
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a session deleted mid-renewal (sign-out in another tab) as logged out instead of throwing", async () => {
    addUser();
    const token = generateSessionToken();
    await sessions.createSession(token, "user_1", {});
    at(16 * DAY);

    // Another request signs out right after this one reads the row.
    const read = fake.db.session.findUnique.bind(fake.db.session);
    vi.spyOn(fake.db.session, "findUnique").mockImplementation(async (args) => {
      const row = await read(args);
      await fake.db.session.deleteMany({ where: { id: hashToken(token) } });
      return row;
    });

    await expect(sessions.validateSessionToken(token)).resolves.toBeNull();
  });
});
