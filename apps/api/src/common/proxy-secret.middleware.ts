import { timingSafeEqual } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/**
 * Rejects any request that didn't come through the web proxy (AC13). Runs
 * first, so every later check can trust the other `x-stride-*` headers.
 * `/cron/*` is exempt: later specs give it its own Bearer check.
 */
@Injectable()
export class ProxySecretMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split("?")[0];
    if (path.startsWith("/cron/")) return next();

    if (!isValidSecret(req.headers["x-stride-proxy-secret"])) {
      res.status(401).end();
      return;
    }
    next();
  }
}

function isValidSecret(sent: string | string[] | undefined): boolean {
  const expected = process.env.WEB_PROXY_SECRET;
  if (!expected || typeof sent !== "string") return false;

  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
