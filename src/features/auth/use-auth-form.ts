"use client";

import { useState, type FocusEvent, type FormEvent } from "react";
import type { z } from "zod";

import type { AuthFormState } from "./form-state";

type Field = keyof NonNullable<AuthFormState["fieldErrors"]>;

/**
 * Client-side validation with the same Zod schema the Server Action uses:
 * a field is checked on blur (Input README: not on every keystroke) and the
 * whole form on submit, which is blocked while anything is invalid. Server
 * errors show until the shopper re-checks that field or submits again.
 */
export function useAuthForm(schema: z.ZodObject, state: AuthFormState) {
  // null = checked on the client and fine, which hides a stale server error.
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<Field, string | null>>
  >({});
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setClientErrors({});
  }

  function check(field: Field, value: string): string | null {
    const result = schema.shape[field]?.safeParse(value);
    return result && !result.success ? result.error.issues[0].message : null;
  }

  return {
    errorFor(field: Field): string | undefined {
      return field in clientErrors
        ? (clientErrors[field] ?? undefined)
        : state.fieldErrors?.[field];
    },
    onBlur(event: FocusEvent<HTMLInputElement>) {
      const { name, value } = event.currentTarget;
      setClientErrors((errors) => ({
        ...errors,
        [name]: check(name as Field, value),
      }));
    },
    onSubmit(event: FormEvent<HTMLFormElement>) {
      const data = new FormData(event.currentTarget);
      const errors = Object.fromEntries(
        Object.keys(schema.shape).map((field) => [
          field,
          check(field as Field, String(data.get(field) ?? "")),
        ]),
      ) as Partial<Record<Field, string | null>>;
      setClientErrors(errors);
      if (Object.values(errors).some(Boolean)) event.preventDefault();
    },
  };
}
