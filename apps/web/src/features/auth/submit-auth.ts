import { authErrorSchema, authSuccessSchema } from "@stride/shared";

import type { AuthFormState } from "./form-state";

const ERROR_STATUSES = new Set([400, 401, 409, 429]);

/** The fields kept in the form after an error. Never the password. */
function valuesOf(data: FormData): NonNullable<AuthFormState["values"]> {
  const values: NonNullable<AuthFormState["values"]> = {};
  for (const key of ["name", "email"] as const) {
    const value = data.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/**
 * The useActionState action for the login and sign-up forms: POSTs the fields
 * as JSON to /api/auth/<endpoint> (the browser sends Origin and receives the
 * session cookie through the /api rewrite), maps an error body into
 * AuthFormState, and hands a success's redirectTo to `onSignedIn`. An
 * unexpected response throws to the error boundary, as the Server Action did.
 */
export function submitAuth(
  endpoint: "login" | "signup",
  onSignedIn: (redirectTo: string) => void,
) {
  return async (
    _prev: AuthFormState,
    data: FormData,
  ): Promise<AuthFormState> => {
    const fields = Object.fromEntries(
      [...data].filter(([, value]) => typeof value === "string"),
    );
    const res = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    });
    const body: unknown = await res.json().catch(() => undefined);
    const values = valuesOf(data);

    if (res.ok) {
      // The schema allows same-site paths only (no "//" or "/\"), so a
      // tampered body can't navigate off-site; anything else throws.
      const { redirectTo } = authSuccessSchema.parse(body);
      onSignedIn(redirectTo);
      return { values };
    }
    const error = ERROR_STATUSES.has(res.status)
      ? authErrorSchema.safeParse(body)
      : undefined;
    if (!error?.success) {
      throw new Error(`Unexpected auth response (${res.status})`);
    }
    return { ...error.data, values };
  };
}
