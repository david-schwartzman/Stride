import { HttpStatus } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { fieldErrorsOf, loginSchema, signupSchema } from "@stride/shared";
import type { NextFunction, Request, Response } from "express";

/** The schema whose empty-form errors answer a malformed body, per route. */
const SCHEMAS: Record<string, typeof loginSchema | typeof signupSchema> = {
  "/auth/login": loginSchema,
  "/auth/signup": signupSchema,
};

/**
 * Express error handler placed right after the body parsers. An unparseable
 * body would otherwise reach Nest's router, which turns it into a 400 whose
 * message quotes part of the raw body, possibly a password (AC13). Login and
 * sign-up answer like an empty form, as ZodBodyPipe does for a non-object
 * body; other routes get a generic 400. The body is never echoed or logged.
 */
export function malformedBodyHandler(
  error: { type?: string },
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error?.type !== "entity.parse.failed") return next(error);

  // An empty form submits "" for every field, which gets the friendly messages.
  const schema = SCHEMAS[req.path];
  const emptyForm =
    schema && Object.fromEntries(Object.keys(schema.shape).map((k) => [k, ""]));
  const result = schema?.safeParse(emptyForm);
  res.status(HttpStatus.BAD_REQUEST).json(
    result && !result.success
      ? { fieldErrors: fieldErrorsOf(result.error) }
      : {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Invalid request body.",
        },
  );
}

/**
 * The JSON and form body parsers Nest would add by default (create the app
 * with `bodyParser: false`), followed by malformedBodyHandler.
 */
export function useSafeBodyParsing(app: NestExpressApplication): void {
  app.useBodyParser("json");
  app.useBodyParser("urlencoded", { extended: true });
  app.use(malformedBodyHandler);
}
