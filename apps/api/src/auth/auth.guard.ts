import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { readSessionCookie, setSessionCookie } from "./session-cookie";
import { SessionService, type SessionUser } from "./session.service";

export type AuthenticatedRequest = Request & { user: SessionUser };

/**
 * The API's authorization layer (standards/global/auth-security.md): a valid
 * session cookie puts { id, email, name } on req.user for @CurrentUser();
 * anything else is a 401 with Nest's generic body, never user data.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();
    // Private data (or a 401 about it): never stored by a browser or CDN.
    res.setHeader("Cache-Control", "private, no-store");

    const token = readSessionCookie(req);
    if (!token) throw new UnauthorizedException();
    const result = await this.sessions.validateSessionToken(token);
    if (!result) throw new UnauthorizedException();

    // Sliding renewal moved the expiry; give the browser a fresh Max-Age too.
    // (A Server Component's server-to-server call can't pass this on.)
    if (result.renewed) setSessionCookie(res, token);

    const { id, email, name } = result.user;
    req.user = { id, email, name };
    return true;
  }
}
