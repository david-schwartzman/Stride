import { hash, verify, type Algorithm, type Options } from "@node-rs/argon2";

// The only module that touches Argon2 or the pepper (standards/global/auth-security.md).

const MIN_PEPPER_BYTES = 32;

let pepper: Buffer | undefined;

/**
 * Reads PASSWORD_PEPPER once and checks it. Throws when it is missing, empty or
 * decodes to fewer than 32 bytes, so a misconfigured environment can never store
 * hashes without a pepper. src/instrumentation.ts calls it at server start.
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

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same Argon2 work as a real login for an email with no account, so
 * response time doesn't reveal whether the account exists (AC15).
 */
export async function verifyDummy(): Promise<void> {
  const opts = options();
  dummyHash ??= hash("stride-dummy-password", opts);
  await verify(await dummyHash, "stride-not-the-password", opts);
}
