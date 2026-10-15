// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./testing/fake-db";

const fake = vi.hoisted(() => ({ db: undefined as unknown as FakeDb }));
vi.mock("@/lib/db", () => ({
  get db() {
    return fake.db;
  },
}));

import {
  THROTTLE,
  checkLoginThrottle,
  checkSignupThrottle,
  clearLoginFailures,
  recordLoginFailure,
} from "./throttle";

const MIN = 60 * 1000;
const START = new Date("2026-10-01T12:00:00Z").getTime();
const IP = "203.0.113.7";

function at(ms: number) {
  vi.setSystemTime(START + ms);
}

async function fail(times: number, email = "a@x.com", ip: string | null = IP) {
  for (let i = 0; i < times; i++) await recordLoginFailure(email, ip);
}

describe("login throttle", () => {
  beforeEach(() => {
    fake.db = createFakeDb();
    vi.useFakeTimers();
    at(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports the AC14 back-off table", () => {
    expect(THROTTLE.login.emailDelaysMs).toEqual([
      1 * MIN,
      2 * MIN,
      4 * MIN,
      8 * MIN,
      15 * MIN,
    ]);
    expect(THROTTLE.login).toMatchObject({
      windowMs: 15 * MIN,
      emailMinFailures: 5,
      ipMaxFailures: 30,
      ipBlockMs: 15 * MIN,
    });
    expect(THROTTLE.signup).toEqual({ windowMs: 60 * MIN, maxPerIp: 10 });
  });

  it("allows up to 4 recent failures", async () => {
    await fail(4);

    expect(await checkLoginThrottle("a@x.com", IP)).toEqual({ allowed: true });
  });

  it.each([
    [5, 1],
    [6, 2],
    [7, 4],
    [8, 8],
    [9, 15],
    [12, 15],
  ])(
    "after %i failures, refuses until the last failure + %i min",
    async (n, minutes) => {
      await fail(n);

      at(minutes * MIN - 1000);
      expect(await checkLoginThrottle("a@x.com", IP)).toEqual({
        allowed: false,
        retryAfterMinutes: 1,
      });

      at(minutes * MIN);
      expect(await checkLoginThrottle("a@x.com", IP)).toEqual({
        allowed: true,
      });
    },
  );

  it("reports whole minutes left, rounded up", async () => {
    await fail(8);

    at(30 * 1000);
    expect(await checkLoginThrottle("a@x.com", IP)).toEqual({
      allowed: false,
      retryAfterMinutes: 8,
    });
  });

  it("only counts failures from the last 15 minutes", async () => {
    await fail(4);
    at(16 * MIN);
    await fail(1);

    expect(await checkLoginThrottle("a@x.com", IP)).toEqual({ allowed: true });
  });

  it("shares one counter across case and whitespace variants of the email", async () => {
    await fail(5, "a@x.com");

    expect(await checkLoginThrottle(" A@X.com ", IP)).toMatchObject({
      allowed: false,
    });
    expect(await checkLoginThrottle("a@x.com", IP)).toMatchObject({
      allowed: false,
    });
  });

  it("normalises the email when recording a failure", async () => {
    await fail(5, " A@X.COM ");

    expect(await checkLoginThrottle("a@x.com", IP)).toMatchObject({
      allowed: false,
    });
  });

  it("records one per-email and one per-IP row per failure, account or not", async () => {
    await recordLoginFailure("nobody@x.com", IP);

    expect(fake.db.tables.authAttempt.map((r) => r.key).sort()).toEqual([
      "email:nobody@x.com",
      `ip:${IP}`,
    ]);
  });

  it("doesn't record a refused attempt as a failure", async () => {
    await fail(5);
    const before = fake.db.tables.authAttempt.length;

    await checkLoginThrottle("a@x.com", IP);
    await checkLoginThrottle("a@x.com", IP);

    expect(fake.db.tables.authAttempt).toHaveLength(before);
    at(1 * MIN);
    expect(await checkLoginThrottle("a@x.com", IP)).toEqual({ allowed: true });
  });

  it("clears the email's failures on success, but not the IP's", async () => {
    await fail(5);

    await clearLoginFailures(" A@x.com");

    expect(await checkLoginThrottle("a@x.com", IP)).toEqual({ allowed: true });
    expect(fake.db.tables.authAttempt.map((r) => r.key)).toEqual(
      Array(5).fill(`ip:${IP}`),
    );
  });

  it("blocks an IP for 15 minutes after its 30th failure in 15 minutes", async () => {
    // 30 failures spread over many emails, each below the per-email threshold.
    for (let i = 0; i < 30; i++) {
      at(i * 10 * 1000);
      await recordLoginFailure(`user${i}@x.com`, IP);
    }
    const thirtieth = 29 * 10 * 1000;

    at(thirtieth + 1000);
    expect(await checkLoginThrottle("fresh@x.com", IP)).toEqual({
      allowed: false,
      retryAfterMinutes: 15,
    });
    expect(await checkLoginThrottle("fresh@x.com", "198.51.100.1")).toEqual({
      allowed: true,
    });

    // Still blocked after the first failures have left the 15-minute window.
    at(thirtieth + 14 * MIN);
    expect(await checkLoginThrottle("fresh@x.com", IP)).toEqual({
      allowed: false,
      retryAfterMinutes: 1,
    });

    at(thirtieth + 15 * MIN);
    expect(await checkLoginThrottle("fresh@x.com", IP)).toEqual({
      allowed: true,
    });
  });

  it("counts IPv6 failures per /64, so rotating addresses doesn't reset the IP limit", async () => {
    for (let i = 0; i < 30; i++)
      await recordLoginFailure(`user${i}@x.com`, `2001:db8:1:2::${i + 1}`);

    expect(
      await checkLoginThrottle("fresh@x.com", "2001:db8:1:2::ffff"),
    ).toMatchObject({
      allowed: false,
    });
    expect(await checkLoginThrottle("fresh@x.com", "2001:db8:1:3::1")).toEqual({
      allowed: true,
    });
    expect(
      fake.db.tables.authAttempt
        .filter((r) => String(r.key).startsWith("ip:"))
        .every((r) => r.key === "ip:2001:db8:1:2::/64"),
    ).toBe(true);
  });

  it("allows the attempt when the email's failures are cleared mid-check", async () => {
    await fail(5);
    // A successful login in another tab clears the rows between count and findFirst.
    const findFirst = fake.db.authAttempt.findFirst.bind(fake.db.authAttempt);
    vi.spyOn(fake.db.authAttempt, "findFirst").mockImplementationOnce(
      async (args) => {
        await clearLoginFailures("a@x.com");
        return findFirst(args);
      },
    );

    expect(await checkLoginThrottle("a@x.com", IP)).toEqual({ allowed: true });
  });

  it("doesn't block an IP for 29 failures", async () => {
    for (let i = 0; i < 29; i++) await recordLoginFailure(`user${i}@x.com`, IP);

    expect(await checkLoginThrottle("fresh@x.com", IP)).toEqual({
      allowed: true,
    });
  });

  it("skips per-IP checks and rows when the IP is null, keeping per-email ones", async () => {
    await fail(5, "a@x.com", null);

    expect(fake.db.tables.authAttempt.map((r) => r.key)).toEqual(
      Array(5).fill("email:a@x.com"),
    );
    expect(await checkLoginThrottle("a@x.com", null)).toMatchObject({
      allowed: false,
    });
    expect(await checkLoginThrottle("b@x.com", null)).toEqual({
      allowed: true,
    });
  });
});

describe("signup throttle", () => {
  beforeEach(() => {
    fake.db = createFakeDb();
    vi.useFakeTimers();
    at(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows 10 sign-ups per IP in 60 minutes and refuses the 11th", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await checkSignupThrottle(IP)).toEqual({ allowed: true });
    }

    expect(await checkSignupThrottle(IP)).toEqual({ allowed: false });
    expect(fake.db.tables.authAttempt).toHaveLength(10);
    expect(await checkSignupThrottle("198.51.100.1")).toEqual({
      allowed: true,
    });
  });

  it("counts IPv6 sign-ups per /64", async () => {
    for (let i = 0; i < 10; i++)
      await checkSignupThrottle(`2001:db8:1:2::${i + 1}`);

    expect(await checkSignupThrottle("2001:db8:1:2:abcd::1")).toEqual({
      allowed: false,
    });
    expect(await checkSignupThrottle("2001:db8:1:3::1")).toEqual({
      allowed: true,
    });
  });

  it("allows sign-ups again once older attempts leave the 60-minute window", async () => {
    for (let i = 0; i < 10; i++) await checkSignupThrottle(IP);

    at(60 * MIN);
    expect(await checkSignupThrottle(IP)).toEqual({ allowed: true });
  });

  it("skips the check when the IP is null", async () => {
    for (let i = 0; i < 12; i++) {
      expect(await checkSignupThrottle(null)).toEqual({ allowed: true });
    }
    expect(fake.db.tables.authAttempt).toHaveLength(0);
  });
});
