"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/sign-in";
import { checkSignupThrottle } from "@/lib/auth/throttle";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request-ip";

import { MESSAGES, type AuthFormState } from "./form-state";
import { runOnSignedIn } from "./run-on-signed-in";
import { fieldErrorsOf, signupSchema } from "./schemas";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const requestHeaders = await headers();
  const input = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  };
  const values = { name: input.name, email: input.email };

  if (!(await checkSignupThrottle(getClientIp(requestHeaders))).allowed) {
    return { formError: MESSAGES.signupLimit, values };
  }

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const { name, email, password } = parsed.data;

  let userId: string;
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    userId = user.id;
  } catch (error) {
    // The unique index decides, so two racing sign-ups can't both succeed.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { fieldErrors: { email: MESSAGES.emailTaken }, values };
    }
    throw error;
  }

  await startSession(userId, requestHeaders);
  await runOnSignedIn(userId);
  redirect("/");
}
