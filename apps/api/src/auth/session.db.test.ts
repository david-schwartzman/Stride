// covers AC14, AC15 (auth-api-migration T3; ported from apps/web/src/lib/auth/session.db.test.ts)
// Integration test against a real, migrated Postgres. Runs only when
// TEST_DATABASE_URL is set (CI sets it; see the signup-login spec, T12).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import {
  SESSION_MAX_AGE_MS,
  SESSION_TTL_MS,
  SessionService,
  generateSessionToken,
  hashToken,
} from "./session.service";

const url = process.env.TEST_DATABASE_URL;
// Each test makes many sequential round trips; a remote database (Neon) needs
// far more than Vitest's 5 s default.
const TIMEOUT_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!url)(
  "SessionService (Postgres)",
  { timeout: TIMEOUT_MS },
  () => {
    let db: PrismaService;
    let sessions: SessionService;
    let userId: string;

    beforeAll(async () => {
      db = new PrismaService({ datasourceUrl: url });
      sessions = new SessionService(db);
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
    });

    it("stores only the token hash and validates the token", async () => {
      const token = generateSessionToken();
      await sessions.createSession(token, userId, {
        userAgent: "vitest",
        ipAddress: null,
      });

      const row = await db.session.findUnique({
        where: { id: hashToken(token) },
      });
      expect(row?.userId).toBe(userId);
      expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
      expect((await sessions.validateSessionToken(token))?.user.id).toBe(
        userId,
      );
    });

    it("rejects a copy of the token after invalidateSession", async () => {
      const token = generateSessionToken();
      await sessions.createSession(token, userId, {});
      const copy = token;

      await sessions.invalidateSession(token);

      expect(await sessions.validateSessionToken(copy)).toBeNull();
      expect(await db.session.count({ where: { id: hashToken(token) } })).toBe(
        0,
      );
    });

    it("slides expiry to 30 days once under 15 are left, in the database", async () => {
      const token = generateSessionToken();
      await sessions.createSession(token, userId, {});
      const id = hashToken(token);
      await db.session.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() + 10 * DAY_MS) },
      });

      const before = Date.now();
      const result = await sessions.validateSessionToken(token);

      const row = await db.session.findUniqueOrThrow({ where: { id } });
      expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + SESSION_TTL_MS,
      );
      expect(result?.session.expiresAt).toEqual(row.expiresAt);
    });

    it("never renews past createdAt + 90 days, in the database", async () => {
      const token = generateSessionToken();
      await sessions.createSession(token, userId, {});
      const id = hashToken(token);
      const createdAt = new Date(Date.now() - 80 * DAY_MS);
      await db.session.update({
        where: { id },
        data: { createdAt, expiresAt: new Date(Date.now() + 5 * DAY_MS) },
      });

      await sessions.validateSessionToken(token);

      const row = await db.session.findUniqueOrThrow({ where: { id } });
      expect(row.expiresAt.getTime()).toBe(
        createdAt.getTime() + SESSION_MAX_AGE_MS,
      );
    });
  },
);
