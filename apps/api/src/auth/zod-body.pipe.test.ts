// covers AC2, AC8, AC13 (auth-api-migration T14)
import { BadRequestException } from "@nestjs/common";
import { authErrorSchema, loginSchema, signupSchema } from "@stride/shared";
import { describe, expect, it } from "vitest";

import { ZodBodyPipe } from "./zod-body.pipe";

function rejection(pipe: ZodBodyPipe<typeof signupSchema>, body: unknown) {
  try {
    pipe.transform(body);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const http = error as BadRequestException;
    expect(http.getStatus()).toBe(400);
    return http.getResponse();
  }
  return expect.unreachable("expected a 400");
}

describe("ZodBodyPipe", () => {
  const signup = new ZodBodyPipe(signupSchema);

  it("returns the parsed body, with the shared schema's transforms applied", () => {
    expect(
      new ZodBodyPipe(loginSchema).transform({
        email: "  Ada@Example.COM ",
        password: "correct horse battery",
      }),
    ).toEqual({ email: "ada@example.com", password: "correct horse battery" });
  });

  it("answers 400 { fieldErrors } with the shared schema's first message per field", () => {
    const body = rejection(signup, {
      name: " ",
      email: "not-an-email",
      password: "short",
    });

    expect(body).toEqual({
      fieldErrors: {
        name: "Enter your name.",
        email: "Enter a valid email address.",
        password: "Use at least 12 characters.",
      },
    });
    expect(authErrorSchema.strict().parse(body)).toEqual(body);
  });

  it("reports missing fields per field when the body isn't an object", () => {
    for (const body of [undefined, null, "name=Ada", 42, ["Ada"]]) {
      const response = rejection(signup, body) as {
        fieldErrors: Record<string, string>;
      };
      expect(Object.keys(response)).toEqual(["fieldErrors"]);
      expect(Object.keys(response.fieldErrors).sort()).toEqual([
        "email",
        "name",
        "password",
      ]);
    }
  });

  it("never echoes the submitted values", () => {
    const password = "hunter2-secret";
    const body = rejection(signup, {
      name: "x".repeat(101),
      email: "bad@@x",
      password,
    });

    expect(JSON.stringify(body)).not.toContain(password);
    expect(JSON.stringify(body)).not.toContain("bad@@x");
  });
});
