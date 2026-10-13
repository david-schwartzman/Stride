"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { hashPassword, verifyDummy, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/sign-in";
import {
  checkLoginThrottle,
  checkSignupThrottle,
  clearLoginFailures,
  recordLoginFailure,
  withdrawLoginAttempt,
} from "@/lib/auth/throttle";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request-ip";

import { MESSAGES, type AuthFormState } from "./form-state";
import { runOnSignedIn } from "./run-on-signed-in";
import { fieldErrorsOf, loginSchema, signupSchema } from "./schemas";

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

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const requestHeaders = await headers();
  const input = {
    email: field(formData, "email"),
    password: field(formData, "password"),
  };
  const values = { email: input.email };

  // Parse first: the throttle keys on the normalised email.
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const { email, password } = parsed.data;
  const ip = getClientIp(requestHeaders);

  // Recorded as a failure up front, so parallel attempts count against each
  // other; withdrawn below if this one is refused or succeeds.
  const attempt = await recordLoginFailure(email, ip);
  const throttle = await checkLoginThrottle(email, ip, attempt);
  if (!throttle.allowed) {
    await withdrawLoginAttempt(attempt);
    return {
      formError: MESSAGES.tooManyAttempts(throttle.retryAfterMinutes),
      values,
    };
  }

  const user = await db.user.findUnique({ where: { email } });
  // An unknown email takes the same path as a wrong password: same Argon2
  // work, same failure records, same message (AC15).
  if (!user) await verifyDummy();
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return { fieldErrors: { password: MESSAGES.wrongPassword }, values };
  }

  await clearLoginFailures(email);
  await withdrawLoginAttempt(attempt);
  await startSession(user.id, requestHeaders);
  await runOnSignedIn(user.id);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
