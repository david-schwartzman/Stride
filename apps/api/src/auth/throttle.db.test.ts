// covers AC4, AC14, AC15 (auth-api-migration T3; ported from apps/web/src/lib/auth/throttle.db.test.ts)
// Integration test against a real, migrated Postgres, so the throttle's query
// shapes (createMany, notIn, windowed count, ordered findFirst) run for real,
// not only against fake-db.ts. Runs only when TEST_DATABASE_URL is set (CI).
import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { ipThrottleBucket } from "./ip-bucket";
import { ThrottleService } from "./throttle.service";

const url = process.env.TEST_DATABASE_URL;
// Each test makes many sequential round trips; a remote database (Neon) needs
// far more than Vitest's 5 s default.
const TIMEOUT_MS = 60_000;

// Fresh per run, so rows left by earlier runs never count: a random IPv6 /64.
function freshNetwork() {
  const group = () => randomInt(1, 0xffff).toString(16);
  const prefix = `2001:db8:${group()}:${group()}`;
  return (host: number) => `${prefix}::${host.toString(16)}`;
}
const freshEmail = () => `throttle-${randomUUID()}@test.stride`;

describe.skipIf(!url)(
  "ThrottleService (Postgres)",
  { timeout: TIMEOUT_MS },
  () => {
    let db: PrismaService;
    let throttle: ThrottleService;
    const keys = new Set<string>();

    beforeAll(() => {
      db = new PrismaService({ datasourceUrl: url });
      throttle = new ThrottleService(db);
    });

    afterAll(async () => {
      await db?.authAttempt.deleteMany({
        where: {
          key: {
            in: [...keys].flatMap((k) => [
              `email:${k}`,
              `ip:${k}`,
              `signup-ip:${k}`,
            ]),
          },
        },
      });
      await db?.$disconnect();
    });

    function track(email: string | null, ip: string | null) {
      if (email) keys.add(email);
      if (ip) keys.add(ipThrottleBucket(ip));
    }

    it("allows 4 failures for an email and blocks the 5th for a minute", async () => {
      const email = freshEmail();
      track(email, null);

      for (let i = 0; i < 4; i++)
        await throttle.recordLoginFailure(email, null);
      expect(await throttle.checkLoginThrottle(email, null)).toEqual({
        allowed: true,
      });

      await throttle.recordLoginFailure(email, null);
      expect(await throttle.checkLoginThrottle(email, null)).toEqual({
        allowed: false,
        retryAfterMinutes: 1,
      });

      await throttle.clearLoginFailures(email);
      expect(await throttle.checkLoginThrottle(email, null)).toEqual({
        allowed: true,
      });
    });

    it("doesn't count the request's own attempt, and withdraws it", async () => {
      const email = freshEmail();
      track(email, null);
      for (let i = 0; i < 4; i++)
        await throttle.recordLoginFailure(email, null);

      const attempt = await throttle.recordLoginFailure(email, null);
      expect(await throttle.checkLoginThrottle(email, null, attempt)).toEqual({
        allowed: true,
      });

      await throttle.withdrawLoginAttempt(attempt);
      expect(
        await db.authAttempt.count({ where: { key: `email:${email}` } }),
      ).toBe(4);
    });

    it("blocks an IPv6 /64 after 30 failures across addresses", async () => {
      const host = freshNetwork();
      track(null, host(1));

      for (let i = 1; i <= 30; i++) {
        const email = freshEmail();
        track(email, null);
        await throttle.recordLoginFailure(email, host(i));
      }

      expect(
        await throttle.checkLoginThrottle("x@test.stride", host(0xffff)),
      ).toEqual({
        allowed: false,
        retryAfterMinutes: 15,
      });
      expect(
        await throttle.checkLoginThrottle("x@test.stride", freshNetwork()(1)),
      ).toEqual({ allowed: true });
    });

    it("allows 10 sign-ups per IP and refuses the 11th", async () => {
      const host = freshNetwork();
      track(null, host(1));

      for (let i = 1; i <= 10; i++) {
        expect(await throttle.checkSignupThrottle(host(i))).toEqual({
          allowed: true,
        });
      }
      expect(await throttle.checkSignupThrottle(host(11))).toEqual({
        allowed: false,
      });
      expect(
        await db.authAttempt.count({
          where: { key: `signup-ip:${ipThrottleBucket(host(1))}` },
        }),
      ).toBe(10);
    });
  },
);
