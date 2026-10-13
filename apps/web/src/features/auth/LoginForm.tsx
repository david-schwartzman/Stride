"use client";

import { loginSchema } from "@stride/shared";
import { useActionState } from "react";

import { Input } from "@/components/ui/Input";

import { loginAction } from "./actions";
import type { AuthFormState } from "./form-state";
import { FormError } from "./FormError";
import { SubmitButton } from "./SubmitButton";
import { useAuthForm } from "./use-auth-form";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const { errorFor, onBlur, onSubmit } = useAuthForm(loginSchema, state);

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <FormError message={state.formError} />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={errorFor("email")}
        onBlur={onBlur}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errorFor("password")}
        onBlur={onBlur}
      />
      <SubmitButton label="Log in" pendingLabel="Logging in…" />
    </form>
  );
}
