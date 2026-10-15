import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";

import { authMalformedBody } from "./auth/malformed-body";
import { useSafeBodyParsing } from "./common/body-parsing";
import { ProxySecretMiddleware } from "./common/proxy-secret.middleware";

/**
 * The Express pipeline in front of Nest's router, in order. Create the app
 * with `bodyParser: false`. main.ts and the wiring tests both call this.
 *
 * 1. The proxy-secret check runs first, before the body is read, so a request
 *    that didn't come through the web proxy gets 401 with an empty body even
 *    when its body is malformed (standards/global/auth-security.md).
 * 2. Body parsing that never echoes a malformed body (common/body-parsing.ts).
 * 3. cookie-parser, for the auth module's session cookie.
 *
 * The Origin check stays a Nest middleware in AppModule; it runs after these.
 */
export function setupApp(app: NestExpressApplication): void {
  app.disable("x-powered-by");
  const proxySecret = new ProxySecretMiddleware();
  app.use(proxySecret.use.bind(proxySecret));
  useSafeBodyParsing(app, authMalformedBody);
  app.use(cookieParser());
}
