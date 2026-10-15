// covers AC12, AC15 (auth-api-migration T2; ported from apps/web/src/lib/auth/password.test.ts)
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@node-rs/argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@node-rs/argon2")>();
  return { ...actual, hash: vi.fn(actual.hash), verify: vi.fn(actual.verify) };
});

const PEPPER = randomBytes(32).toString("base64");
const OTHER_PEPPER = randomBytes(32).toString("base64");

// password.service.ts reads the pepper once, so each test gets a fresh module.
async function loadPassword(pepper: string | undefined) {
  vi.resetModules();
  if (pepper === undefined) vi.stubEnv("PASSWORD_PEPPER", undefined);
  else vi.stubEnv("PASSWORD_PEPPER", pepper);
  return import("./password.service.js");
}

describe("password", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hashes with Argon2id and the configured cost, never storing the plain password", async () => {
    const { hashPassword } = await loadPassword(PEPPER);
    const hash = await hashPassword("correct horse battery");

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain("correct horse battery");
  });

  it("salts each hash", async () => {
    const { hashPassword } = await loadPassword(PEPPER);

    expect(await hashPassword("correct horse battery")).not.toBe(
      await hashPassword("correct horse battery"),
    );
  });

  it("verifies the right password", async () => {
    const { hashPassword, verifyPassword } = await loadPassword(PEPPER);
    const hash = await hashPassword("correct horse battery");

    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const { hashPassword, verifyPassword } = await loadPassword(PEPPER);
    const hash = await hashPassword("correct horse battery");

    expect(await verifyPassword(hash, "correct horse batterY")).toBe(false);
  });

  it("rejects the right password under a different pepper", async () => {
    const { hashPassword } = await loadPassword(PEPPER);
    const hash = await hashPassword("correct horse battery");

    const { verifyPassword } = await loadPassword(OTHER_PEPPER);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    const { verifyPassword } = await loadPassword(PEPPER);

    expect(await verifyPassword("not-a-hash", "correct horse battery")).toBe(
      false,
    );
  });

  it("verifyDummy resolves without revealing anything", async () => {
    const { verifyDummy } = await loadPassword(PEPPER);

    await expect(verifyDummy()).resolves.toBeUndefined();
  });

  it("verifyDummy runs one verify against a precomputed hash with the production cost, never a hash", async () => {
    const { DUMMY_HASH, hashPassword, verifyDummy } =
      await loadPassword(PEPPER);
    const argon2 = await import("@node-rs/argon2");
    const real = await hashPassword("correct horse battery");
    vi.mocked(argon2.hash).mockClear();
    vi.mocked(argon2.verify).mockClear();

    await verifyDummy();

    // Same algorithm and cost parameters, so the verify costs the same as a real one.
    const params = (h: string) => h.split("$").slice(1, 4).join("$");
    expect(params(DUMMY_HASH)).toBe(params(real));
    expect(argon2.hash).not.toHaveBeenCalled();
    expect(argon2.verify).toHaveBeenCalledTimes(1);
    expect(vi.mocked(argon2.verify).mock.calls[0][0]).toBe(DUMMY_HASH);
  });

  it("verifyDummy still needs a valid pepper", async () => {
    const { verifyDummy } = await loadPassword("");

    await expect(verifyDummy()).rejects.toThrow(/PASSWORD_PEPPER/);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["shorter than 32 bytes", randomBytes(31).toString("base64")],
  ])("throws when the pepper is %s", async (_label, pepper) => {
    const { getPepper, hashPassword } = await loadPassword(pepper);

    expect(() => getPepper()).toThrow(/PASSWORD_PEPPER/);
    await expect(hashPassword("correct horse battery")).rejects.toThrow(
      /PASSWORD_PEPPER/,
    );
  });

  it("never puts the pepper in the error message", async () => {
    const short = randomBytes(16).toString("base64");
    const { getPepper } = await loadPassword(short);

    expect(() => getPepper()).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(short) }),
    );
  });
});
