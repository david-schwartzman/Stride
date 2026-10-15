/** User-facing auth messages, shared by the API's responses and the forms. */
export const MESSAGES = {
  emailTaken: "An account with this email already exists. Log in instead.",
  wrongPassword: "That password isn't right. Try again.",
  signupLimit: "Too many sign-ups from this network. Try again later.",
  tooManyAttempts: (minutes: number) =>
    `Too many attempts, try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
} as const;
