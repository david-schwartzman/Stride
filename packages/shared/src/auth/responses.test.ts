// covers AC8, AC2, AC3, AC7 (auth-api-migration T1)
import { describe, expect, it } from "vitest";

import {
  authErrorSchema,
  authSuccessSchema,
  meResponseSchema,
} from "./responses";

describe("authSuccessSchema", () => {
  it("accepts a relative redirect target", () => {
    expect(authSuccessSchema.parse({ redirectTo: "/" })).toEqual({
      redirectTo: "/",
    });
  });

  it.each([{}, { redirectTo: "" }, { redirectTo: "https://evil.example" }])(
    "rejects %j",
    (body) => {
      expect(authSuccessSchema.safeParse(body).success).toBe(false);
    },
  );
});

describe("authErrorSchema", () => {
  it("accepts field errors", () => {
    const body = { fieldErrors: { email: "Enter a valid email address." } };
    expect(authErrorSchema.parse(body)).toEqual(body);
  });

  it("accepts a form error", () => {
    const body = { formError: "Too many attempts, try again in 1 minute." };
    expect(authErrorSchema.parse(body)).toEqual(body);
  });

  it("drops fields outside name, email and password", () => {
    expect(
      authErrorSchema.parse({ fieldErrors: { password: "x", token: "t" } }),
    ).toEqual({ fieldErrors: { password: "x" } });
  });

  it("rejects a non-string message", () => {
    expect(authErrorSchema.safeParse({ formError: 1 }).success).toBe(false);
  });
});

describe("meResponseSchema", () => {
  const me = { id: "u1", email: "ada@x.com", name: "Ada" };

  it("accepts id, email and name", () => {
    expect(meResponseSchema.parse(me)).toEqual(me);
  });

  it("strips anything else, such as a password hash", () => {
    expect(meResponseSchema.parse({ ...me, passwordHash: "h" })).toEqual(me);
  });

  it.each(["id", "email", "name"])("requires %s", (key) => {
    const { [key as keyof typeof me]: _omit, ...rest } = me;
    expect(meResponseSchema.safeParse(rest).success).toBe(false);
  });
});
