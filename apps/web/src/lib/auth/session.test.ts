// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./testing/fake-db";

const fake = vi.hoisted(() => ({ db: undefined as unknown as FakeDb }));
vi.mock("@/lib/db", () => ({
  get db() {
    return fake.db;
  },
}));

import {
  createSession,
  generateSessionToken,
  hashToken,
  invalidateAllSessions,
  invalidateSession,
  validateSessionToken,
} from "./session";

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

    const session = await createSession(token, userId, {
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
    await createSession(token, userId, {});

    const result = await validateSessionToken(token);

    expect(result?.session.id).toBe(hashToken(token));
    expect(result?.user).toEqual({
      id: userId,
      email: "user_1@x.com",
      name: "Ada",
    });
  });

  it("returns null for an unknown token", async () => {
    expect(await validateSessionToken(generateSessionToken())).toBeNull();
  });

  it("doesn't renew while more than 15 days are left", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await createSession(token, userId, {});

    at(14 * DAY);
    const result = await validateSessionToken(token);

    expect(result?.session.expiresAt).toEqual(
      new Date(START.getTime() + 30 * DAY),
    );
  });

  it("slides expiry to now + 30 days once fewer than 15 days are left", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await createSession(token, userId, {});

    at(16 * DAY);
    const result = await validateSessionToken(token);

    const expected = new Date(START.getTime() + 46 * DAY);
    expect(result?.session.expiresAt).toEqual(expected);
    expect(fake.db.tables.session[0].expiresAt).toEqual(expected);
  });

  it("never renews beyond createdAt + 90 days", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await createSession(token, userId, {});

    // Keep the session alive with a request every 16 days.
    for (const day of [16, 32, 48, 64, 80]) {
      at(day * DAY);
      expect(await validateSessionToken(token)).not.toBeNull();
    }

    const cap = new Date(START.getTime() + 90 * DAY);
    expect(fake.db.tables.session[0].expiresAt).toEqual(cap);

    at(90 * DAY);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("treats an expired session as logged out and deletes its row", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await createSession(token, userId, {});

    at(30 * DAY);

    expect(await validateSessionToken(token)).toBeNull();
    expect(fake.db.tables.session).toHaveLength(0);
  });

  it("invalidateSession deletes the row, and the old token is rejected (AC16)", async () => {
    const userId = addUser();
    const token = generateSessionToken();
    await createSession(token, userId, {});

    await invalidateSession(token);

    expect(fake.db.tables.session).toHaveLength(0);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("invalidateAllSessions removes only that user's sessions", async () => {
    const ada = addUser("ada");
    const bob = addUser("bob");
    const adaPhone = generateSessionToken();
    const adaLaptop = generateSessionToken();
    const bobToken = generateSessionToken();
    await createSession(adaPhone, ada, {});
    await createSession(adaLaptop, ada, {});
    await createSession(bobToken, bob, {});

    await invalidateAllSessions(ada);

    expect(await validateSessionToken(adaPhone)).toBeNull();
    expect(await validateSessionToken(adaLaptop)).toBeNull();
    expect(await validateSessionToken(bobToken)).not.toBeNull();
  });
});

describe("session renewal race", () => {
  beforeEach(() => {
    fake.db = createFakeDb();
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a session deleted mid-renewal (sign-out in another tab) as logged out instead of throwing", async () => {
    addUser();
    const token = generateSessionToken();
    await createSession(token, "user_1", {});
    at(16 * DAY);

    // Another request signs out right after this one reads the row.
    const read = fake.db.session.findUnique.bind(fake.db.session);
    vi.spyOn(fake.db.session, "findUnique").mockImplementation(async (args) => {
      const row = await read(args);
      await fake.db.session.deleteMany({ where: { id: hashToken(token) } });
      return row;
    });

    await expect(validateSessionToken(token)).resolves.toBeNull();
  });
});
