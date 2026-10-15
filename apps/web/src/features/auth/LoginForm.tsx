"use client";

import { loginSchema } from "@stride/shared";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { Input } from "@/components/ui/Input";

import type { AuthFormState } from "./form-state";
import { FormError } from "./FormError";
import { submitAuth } from "./submit-auth";
import { SubmitButton } from "./SubmitButton";
import { useAuthForm } from "./use-auth-form";

const initialState: AuthFormState = {};

export function LoginForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    submitAuth("login", (redirectTo) => {
      router.replace(redirectTo);
      router.refresh();
    }),
    initialState,
  );
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
