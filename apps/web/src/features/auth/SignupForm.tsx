"use client";

import Link from "next/link";
import { MESSAGES, signupSchema } from "@stride/shared";
import { useActionState } from "react";

import { Input } from "@/components/ui/Input";

import { signupAction } from "./actions";
import type { AuthFormState } from "./form-state";
import { FormError } from "./FormError";
import { SubmitButton } from "./SubmitButton";
import { useAuthForm } from "./use-auth-form";

const initialState: AuthFormState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialState);
  const { errorFor, onBlur, onSubmit } = useAuthForm(signupSchema, state);

  const emailError = errorFor("email");

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <FormError message={state.formError} />
      <Input
        label="Name"
        name="name"
        autoComplete="name"
        defaultValue={state.values?.name}
        error={errorFor("name")}
        onBlur={onBlur}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={
          emailError === MESSAGES.emailTaken ? (
            <>
              An account with this email already exists.{" "}
              <Link href="/login" className="font-bold underline">
                Log in
              </Link>{" "}
              instead.
            </>
          ) : (
            emailError
          )
        }
        onBlur={onBlur}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 12 characters."
        error={errorFor("password")}
        onBlur={onBlur}
      />
      <SubmitButton label="Create account" pendingLabel="Creating account…" />
    </form>
  );
}
