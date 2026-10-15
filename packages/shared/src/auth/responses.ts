import { z } from "zod";

// Bodies of the API's /auth/* responses (auth-api-migration AC2, AC3, AC7).

/**
 * 200 from `POST /auth/signup|login`: where the form navigates next. Only a
 * same-site path: it starts with one "/" not followed by "/" or "\", since
 * browsers read both "//host" and "/\host" as another site.
 */
export const authSuccessSchema = z.object({
  redirectTo: z.string().regex(/^\/(?![/\\])/),
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
