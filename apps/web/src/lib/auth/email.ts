// Client-safe: the Zod schemas and the throttle both key on this form, so a
// case or whitespace variant of an email can't get its own throttle counter.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
