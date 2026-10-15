import { z } from "zod";

// Bodies of the API's /auth/* responses (auth-api-migration AC2, AC3, AC7).

const ORIGIN_PROBE = "https://x.invalid";

/** True for C0 control characters and DEL. */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * A same-origin path:
 * - it starts with one "/" not followed by "/" or "\", since browsers read
 *   both "//host" and "/\host" as another site;
 * - it has no control characters, since browsers strip tab, CR and LF, so
 *   "/\t/evil.com" would become "//evil.com";
 * - resolved against any origin, it stays on that origin.
 */
function isSameOriginPath(path: string): boolean {
  if (!/^\/(?![/\\])/.test(path) || hasControlChar(path)) return false;
  try {
    return new URL(path, ORIGIN_PROBE).origin === ORIGIN_PROBE;
  } catch {
    return false;
  }
}

/** 200 from `POST /auth/signup|login`: where the form navigates next. */
export const authSuccessSchema = z.object({
  redirectTo: z.string().refine(isSameOriginPath),
});

/** 400/401/409/429 from `POST /auth/signup|login`. Never echoes the password. */
export const authErrorSchema = z.object({
  fieldErrors: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
  formError: z.string().optional(),
});

/** 200 from `GET /auth/me`: the session user and nothing else. */
export const meResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

export type AuthSuccess = z.infer<typeof authSuccessSchema>;
export type AuthError = z.infer<typeof authErrorSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
