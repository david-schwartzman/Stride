import { fieldErrorsOf, loginSchema, signupSchema } from "@stride/shared";

/** The schema whose empty-form errors answer a malformed body, per route. */
const SCHEMAS: Record<string, typeof loginSchema | typeof signupSchema> = {
  "/auth/login": loginSchema,
  "/auth/signup": signupSchema,
};

/**
 * Login and sign-up answer an unparseable body like an empty form, as
 * ZodBodyPipe does for a non-object body (an empty form submits "" for every
 * field, which gets the friendly messages). Other routes get the generic 400
 * from common/body-parsing.ts.
 */
export function authMalformedBody(
  path: string,
): { fieldErrors: Record<string, string> } | undefined {
  const schema = SCHEMAS[path];
  if (!schema) return undefined;
  const emptyForm = Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, ""]),
  );
  const result = schema.safeParse(emptyForm);
  return result.success
    ? undefined
    : { fieldErrors: fieldErrorsOf(result.error) };
}
