import { z } from "zod";

import { normalizeEmail } from "@/lib/auth/email";

// Shared by the forms (client, on blur) and the Server Actions (server).

const name = z.string().trim().min(1, "Enter your name.");

const email = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email("Enter a valid email address."));

// Length only, no composition rules; the cap keeps huge inputs off the hasher.
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.");

export const signupSchema = z.object({ name, email, password });
export const loginSchema = z.object({ email, password });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** The first message per field, e.g. `{ email: "Enter a valid email address." }`. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issue.message;
  }
  return errors;
}
