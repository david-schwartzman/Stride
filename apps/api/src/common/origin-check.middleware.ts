import {
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Blocks cross-site writes (AC8): a state-changing request's `Origin` must be
 * the web origin the shopper is on. That host comes from
 * `x-stride-forwarded-host`, trusted because ProxySecretMiddleware runs first.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (!STATE_CHANGING.has(req.method)) return next();

    const origin = req.headers.origin;
    const host = req.headers["x-stride-forwarded-host"];
    if (!origin || typeof host !== "string" || !host) {
      throw new UnauthorizedException();
    }

    const allowed = [`https://${host}`];
    if (process.env.NODE_ENV !== "production") allowed.push(`http://${host}`);
    if (!allowed.includes(origin)) throw new UnauthorizedException();

    next();
  }
}
