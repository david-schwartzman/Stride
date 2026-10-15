import { HttpStatus } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

/**
 * The 400 body a route answers to an unparseable request body, or undefined
 * for the generic one. Lets a module answer like its own validation does
 * (auth/malformed-body.ts) without this file knowing about it.
 */
export type MalformedBodyAnswer = (path: string) => object | undefined;

const GENERIC = {
  statusCode: HttpStatus.BAD_REQUEST,
  message: "Invalid request body.",
};

/**
 * Express error handler placed right after the body parsers. An unparseable
 * body would otherwise reach Nest's router, which turns it into a 400 whose
 * message quotes part of the raw body, possibly a password (auth-api-migration
 * AC13). The body is never echoed or logged.
 */
export function malformedBodyHandler(answerFor: MalformedBodyAnswer) {
  return (
    error: { type?: string },
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (error?.type !== "entity.parse.failed") return next(error);
    res.status(HttpStatus.BAD_REQUEST).json(answerFor(req.path) ?? GENERIC);
  };
}

/**
 * The JSON and form body parsers Nest would add by default (create the app
 * with `bodyParser: false`), followed by malformedBodyHandler. Register it
 * after the proxy-secret check (setup-app.ts), so a request without the
 * secret is refused before its body is read.
 */
export function useSafeBodyParsing(
  app: NestExpressApplication,
  answerFor: MalformedBodyAnswer = () => undefined,
): void {
  app.useBodyParser("json");
  app.useBodyParser("urlencoded", { extended: true });
  app.use(malformedBodyHandler(answerFor));
}
