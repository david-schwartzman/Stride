import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { ipThrottleBucket } from "@/lib/request-ip";

import { normalizeEmail } from "./email";

// Throttling, never lockout: AuthAttempt rows counted in rolling windows in
// Postgres (serverless instances share no memory). Limits per AC14.

const MIN_MS = 60 * 1000;

export const THROTTLE = {
  login: {
    windowMs: 15 * MIN_MS,
    emailMinFailures: 5,
    // delay(N) for N = 5, 6, 7, 8 and ≥ 9 failures.
    emailDelaysMs: [
      1 * MIN_MS,
      2 * MIN_MS,
      4 * MIN_MS,
      8 * MIN_MS,
      15 * MIN_MS,
    ],
    ipMaxFailures: 30,
    ipBlockMs: 15 * MIN_MS,
  },
  signup: {
    windowMs: 60 * MIN_MS,
    maxPerIp: 10,
  },
} as const;

export type ThrottleResult =
  { allowed: true } | { allowed: false; retryAfterMinutes: number };

const emailKey = (email: string) => `email:${normalizeEmail(email)}`;
// Per-IP keys use the IPv6 /64, not the exact address (see ipThrottleBucket).
const ipKey = (ip: string) => `ip:${ipThrottleBucket(ip)}`;
const signupIpKey = (ip: string) => `signup-ip:${ipThrottleBucket(ip)}`;

function within(ms: number) {
  return { gt: new Date(Date.now() - ms) };
}

/**
 * Checks only. `exclude` is this request's own pending attempt (from
 * recordLoginFailure), so it doesn't count against itself while every other
 * in-flight attempt does.
 */
export async function checkLoginThrottle(
  email: string,
  ip: string | null,
  exclude: string[] = [],
): Promise<ThrottleResult> {
  const until = Math.max(
    await emailBlockedUntil(email, exclude),
    ip ? await ipBlockedUntil(ip, exclude) : 0,
  );
  const left = until - Date.now();
  return left > 0
    ? { allowed: false, retryAfterMinutes: Math.ceil(left / MIN_MS) }
    : { allowed: true };
}

/**
 * Records one failed password check (per email, and per IP when known) and
 * returns the row ids. Unknown emails are recorded alike (AC15).
 *
 * loginAction records *before* checking the throttle and the password, so
 * concurrent attempts see each other instead of all passing the check while
 * the slow Argon2 verify runs. A refused or successful attempt is then taken
 * back with withdrawLoginAttempt, so only failed password checks remain.
 */
export async function recordLoginFailure(
  email: string,
  ip: string | null,
): Promise<string[]> {
  const rows = [
    { id: randomUUID(), key: emailKey(email) },
    ...(ip ? [{ id: randomUUID(), key: ipKey(ip) }] : []),
  ];
  await db.authAttempt.createMany({ data: rows });
  return rows.map((row) => row.id);
}

/** Takes back attempt rows recorded up front (refused or successful login). */
export async function withdrawLoginAttempt(ids: string[]): Promise<void> {
  await db.authAttempt.deleteMany({ where: { id: { in: ids } } });
}

/** After a successful login: clears the email's failures, not the IP's. */
export async function clearLoginFailures(email: string): Promise<void> {
  await db.authAttempt.deleteMany({ where: { key: emailKey(email) } });
}

/**
 * Records the attempt, then counts (its own row included), so concurrent
 * sign-ups from one IP can't all pass a count taken before any of them
 * inserted. A refused attempt is taken back. Skipped when the IP is unknown.
 */
export async function checkSignupThrottle(
  ip: string | null,
): Promise<{ allowed: boolean }> {
  if (!ip) return { allowed: true };

  const { windowMs, maxPerIp } = THROTTLE.signup;
  const key = signupIpKey(ip);
  const id = randomUUID();
  await db.authAttempt.create({ data: { id, key } });

  const recent = await db.authAttempt.count({
    where: { key, createdAt: within(windowMs) },
  });
  if (recent > maxPerIp) {
    await db.authAttempt.deleteMany({ where: { id } });
    return { allowed: false };
  }
  return { allowed: true };
}

async function emailBlockedUntil(
  email: string,
  exclude: string[],
): Promise<number> {
  const { windowMs, emailMinFailures, emailDelaysMs } = THROTTLE.login;
  const where = {
    key: emailKey(email),
    createdAt: within(windowMs),
    id: { notIn: exclude },
  };

  const failures = await db.authAttempt.count({ where });
  if (failures < emailMinFailures) return 0;

  const last = await db.authAttempt.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  const step = Math.min(failures - emailMinFailures, emailDelaysMs.length - 1);
  // Null when clearLoginFailures (a successful login in another tab) ran
  // between the count and this read: nothing left to block on.
  if (!last) return 0;
  return last.createdAt.getTime() + emailDelaysMs[step];
}

async function ipBlockedUntil(ip: string, exclude: string[]): Promise<number> {
  const { windowMs, ipMaxFailures, ipBlockMs } = THROTTLE.login;

  // The block runs 15 minutes from the 30th failure, so it can outlast the
  // failures that caused it; look back far enough to still see them.
  const failures = await db.authAttempt.findMany({
    where: {
      key: ipKey(ip),
      createdAt: within(windowMs + ipBlockMs),
      id: { notIn: exclude },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  let until = 0;
  for (let i = ipMaxFailures - 1; i < failures.length; i++) {
    const nth = failures[i].createdAt.getTime();
    const first = failures[i - ipMaxFailures + 1].createdAt.getTime();
    if (nth - first < windowMs) until = Math.max(until, nth + ipBlockMs);
  }
  return until;
}
