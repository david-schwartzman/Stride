import { hash, verify, type Algorithm, type Options } from "@node-rs/argon2";

// The only module that touches Argon2 or the pepper (standards/global/auth-security.md).
// Ported unchanged from the web app (auth-api-migration).

const MIN_PEPPER_BYTES = 32;

let pepper: Buffer | undefined;

/**
 * Reads PASSWORD_PEPPER once and checks it. Throws when it is missing, empty or
 * decodes to fewer than 32 bytes, so a misconfigured environment can never store
 * hashes without a pepper. AuthModule calls it at boot (AC12).
 */
export function getPepper(): Buffer {
  if (pepper) return pepper;

  const raw = process.env.PASSWORD_PEPPER;
  if (!raw) {
    throw new Error("PASSWORD_PEPPER is not set.");
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length < MIN_PEPPER_BYTES) {
    throw new Error(
      `PASSWORD_PEPPER must decode (base64) to at least ${MIN_PEPPER_BYTES} bytes.`,
    );
  }

  pepper = decoded;
  return pepper;
}

function options(): Options {
  return {
    algorithm: 2 satisfies Algorithm.Argon2id, // const enum value, inlined for isolatedModules
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    secret: getPepper(),
  };
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, options());
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  const opts = options();
  try {
    return await verify(passwordHash, password, opts);
  } catch {
    // A malformed stored hash is a failed login, not a crash.
    return false;
  }
}

/**
 * A throwaway Argon2id hash with the production cost (m=19456, t=2, p=1) made
 * once with a random password and secret that were discarded. Precomputed, so
 * the first unknown-email login on a cold instance doesn't also pay for a hash.
 * Verify cost depends only on the parameters, never on whether the pepper matches.
 */
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$7rQ1eTsMNWdR5tcot3PyqQ$vcga3PmPPsvv4XysWBkIRLBhdEhH9Ya+Q4C9+9AM5BQ";

/**
 * Spends the same Argon2 work as a real login for an email with no account, so
 * response time doesn't reveal whether the account exists (AC15).
 */
export async function verifyDummy(): Promise<void> {
  await verify(DUMMY_HASH, "stride-not-the-password", options());
}
