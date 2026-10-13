import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";

import { db } from "@/lib/db";

// Opaque database sessions: the raw token lives only in the cookie; the
// database keeps sha256(token) as the Session id (standards/global/auth-security.md).

const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_TTL_MS = 30 * DAY_MS;
export const SESSION_RENEW_BELOW_MS = 15 * DAY_MS;
export const SESSION_MAX_AGE_MS = 90 * DAY_MS;

export type SessionUser = { id: string; email: string; name: string };

export type Session = {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

export type SessionValidationResult = {
  session: Session;
  user: SessionUser;
} | null;

/** 32 random bytes (256 bits), base32-encoded. A new one for every sign-in. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export function hashToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(
  token: string,
  userId: string,
  {
    userAgent,
    ipAddress,
  }: { userAgent?: string | null; ipAddress?: string | null },
): Promise<Session> {
  const session = await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    },
  });
  return pick(session);
}

/**
 * Returns the session and its user, or null when the token is unknown or expired
 * (an expired row is deleted). With fewer than 15 days left, expiry slides to
 * now + 30 days, but never past createdAt + 90 days.
 */
export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const id = hashToken(token);
  const row = await db.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!row) return null;

  const now = Date.now();
  if (now >= row.expiresAt.getTime()) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }

  let { expiresAt } = row;
  if (expiresAt.getTime() - now < SESSION_RENEW_BELOW_MS) {
    const renewed = Math.min(
      now + SESSION_TTL_MS,
      row.createdAt.getTime() + SESSION_MAX_AGE_MS,
    );
    if (renewed > expiresAt.getTime()) {
      expiresAt = new Date(renewed);
      await db.session.update({
        where: { id },
        data: { expiresAt, lastSeenAt: new Date(now) },
      });
    }
  }

  return { session: { ...pick(row), expiresAt }, user: row.user };
}

export async function invalidateSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

function pick({ id, userId, createdAt, expiresAt }: Session): Session {
  return { id, userId, createdAt, expiresAt };
}
