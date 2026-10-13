import { db } from "@/lib/db";

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
const ipKey = (ip: string) => `ip:${ip}`;
const signupIpKey = (ip: string) => `signup-ip:${ip}`;

function within(ms: number) {
  return { gt: new Date(Date.now() - ms) };
}

/** Checks only; a refused attempt is never recorded as a failure. */
export async function checkLoginThrottle(
  email: string,
  ip: string | null,
): Promise<ThrottleResult> {
  const until = Math.max(
    await emailBlockedUntil(email),
    ip ? await ipBlockedUntil(ip) : 0,
  );
  const left = until - Date.now();
  return left > 0
    ? { allowed: false, retryAfterMinutes: Math.ceil(left / MIN_MS) }
    : { allowed: true };
}

/** One failed password check. Called for unknown emails too, so they throttle alike (AC15). */
export async function recordLoginFailure(
  email: string,
  ip: string | null,
): Promise<void> {
  await db.authAttempt.createMany({
    data: [{ key: emailKey(email) }, ...(ip ? [{ key: ipKey(ip) }] : [])],
  });
}

/** After a successful login: clears the email's failures, not the IP's. */
export async function clearLoginFailures(email: string): Promise<void> {
  await db.authAttempt.deleteMany({ where: { key: emailKey(email) } });
}

/** Checks, then records the attempt when allowed. Skipped when the IP is unknown. */
export async function checkSignupThrottle(
  ip: string | null,
): Promise<{ allowed: boolean }> {
  if (!ip) return { allowed: true };

  const { windowMs, maxPerIp } = THROTTLE.signup;
  const key = signupIpKey(ip);
  const recent = await db.authAttempt.count({
    where: { key, createdAt: within(windowMs) },
  });
  if (recent >= maxPerIp) return { allowed: false };

  await db.authAttempt.create({ data: { key } });
  return { allowed: true };
}

async function emailBlockedUntil(email: string): Promise<number> {
  const { windowMs, emailMinFailures, emailDelaysMs } = THROTTLE.login;
  const where = { key: emailKey(email), createdAt: within(windowMs) };

  const failures = await db.authAttempt.count({ where });
  if (failures < emailMinFailures) return 0;

  const last = await db.authAttempt.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  const step = Math.min(failures - emailMinFailures, emailDelaysMs.length - 1);
  return last!.createdAt.getTime() + emailDelaysMs[step];
}

async function ipBlockedUntil(ip: string): Promise<number> {
  const { windowMs, ipMaxFailures, ipBlockMs } = THROTTLE.login;

  // The block runs 15 minutes from the 30th failure, so it can outlast the
  // failures that caused it; look back far enough to still see them.
  const failures = await db.authAttempt.findMany({
    where: { key: ipKey(ip), createdAt: within(windowMs + ipBlockMs) },
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
