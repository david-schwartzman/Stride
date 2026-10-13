// What the auth Server Actions return to their forms. The password is never echoed back.
export type AuthFormState = {
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  /** Not tied to one field: throttling refusals. */
  formError?: string;
  values?: { name?: string; email?: string };
};

export const MESSAGES = {
  emailTaken: "An account with this email already exists. Log in instead.",
  wrongPassword: "That password isn't right. Try again.",
  signupLimit: "Too many sign-ups from this network. Try again later.",
  tooManyAttempts: (minutes: number) =>
    `Too many attempts, try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
} as const;
