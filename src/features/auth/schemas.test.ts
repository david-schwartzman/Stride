import { describe, expect, it } from "vitest";

import { fieldErrorsOf, loginSchema, signupSchema } from "./schemas";

const valid = {
  name: "Ada Lovelace",
  email: "ada@x.com",
  password: "a".repeat(12),
};

describe("signupSchema", () => {
  it("accepts a valid sign-up and normalises the email", () => {
    const result = signupSchema.safeParse({ ...valid, email: "  Ada@X.COM " });

    expect(result.success && result.data).toEqual({
      ...valid,
      email: "ada@x.com",
    });
  });

  it("requires a name", () => {
    const result = signupSchema.safeParse({ ...valid, name: "   " });

    expect(!result.success && fieldErrorsOf(result.error)).toEqual({
      name: "Enter your name.",
    });
  });

  it.each(["", "ada", "ada@", "ada @x.com"])(
    "rejects the email %j",
    (email) => {
      const result = signupSchema.safeParse({ ...valid, email });

      expect(!result.success && fieldErrorsOf(result.error)).toEqual({
        email: "Enter a valid email address.",
      });
    },
  );

  it.each([
    ["11 characters", "a".repeat(11), "Use at least 12 characters."],
    ["129 characters", "a".repeat(129), "Use 128 characters or fewer."],
  ])("rejects a password of %s", (_label, password, message) => {
    const result = signupSchema.safeParse({ ...valid, password });

    expect(!result.success && fieldErrorsOf(result.error)).toEqual({
      password: message,
    });
  });

  it.each([12, 128])(
    "accepts a password of %i characters, any characters",
    (length) => {
      const password = Array.from(
        { length },
        (_, i) => ["é", " ", "🙂", "a"][i % 4],
      ).join("");

      expect(signupSchema.safeParse({ ...valid, password }).success).toBe(true);
    },
  );

  it("returns one message per field", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "x",
      password: "",
    });

    expect(!result.success && fieldErrorsOf(result.error)).toEqual({
      name: "Enter your name.",
      email: "Enter a valid email address.",
      password: "Use at least 12 characters.",
    });
  });
});

describe("loginSchema", () => {
  it("accepts email + password and normalises the email", () => {
    const result = loginSchema.safeParse({
      email: " ADA@x.com",
      password: valid.password,
    });

    expect(result.success && result.data).toEqual({
      email: "ada@x.com",
      password: valid.password,
    });
  });

  it("validates the same way as sign-up", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "short" });

    expect(!result.success && fieldErrorsOf(result.error)).toEqual({
      email: "Enter a valid email address.",
      password: "Use at least 12 characters.",
    });
  });
});
