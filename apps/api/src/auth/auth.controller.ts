import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Redirect,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  MESSAGES,
  loginSchema,
  signupSchema,
  type AuthSuccess,
  type LoginInput,
  type MeResponse,
} from "@stride/shared";
import type { Request, Response } from "express";

import { getClientIp } from "../common/request-ip";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser } from "./current-user.decorator";
import { runOnSignedIn } from "./on-signed-in";
import { hashPassword, verifyDummy, verifyPassword } from "./password.service";
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "./session-cookie";
import {
  SessionService,
  generateSessionToken,
  type SessionUser,
} from "./session.service";
import { ThrottleService } from "./throttle.service";
import { ZodBodyPipe } from "./zod-body.pipe";

const SIGNED_IN: AuthSuccess = { redirectTo: "/" };

function tooManyRequests(formError: string) {
  return new HttpException({ formError }, HttpStatus.TOO_MANY_REQUESTS);
}

/**
 * /auth/* (reached by the browser as /api/auth/* through the web's rewrite).
 * Bodies and errors follow the shared auth contract; nothing here logs a
 * request body, password, token or cookie (AC13).
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly throttle: ThrottleService,
  ) {}

  @Post("signup")
  @HttpCode(HttpStatus.OK)
  async signup(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSuccess> {
    // The per-IP limit comes before validation, so even invalid bodies count.
    if (!(await this.throttle.checkSignupThrottle(getClientIp(req))).allowed) {
      throw tooManyRequests(MESSAGES.signupLimit);
    }
    const { name, email, password } = new ZodBodyPipe(signupSchema).transform(
      body,
    );

    let userId: string;
    try {
      const user = await this.prisma.user.create({
        data: { name, email, passwordHash: await hashPassword(password) },
      });
      userId = user.id;
    } catch (error) {
      // The unique index decides, so two racing sign-ups can't both succeed.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          fieldErrors: { email: MESSAGES.emailTaken },
        });
      }
      throw error;
    }

    await this.startSession(userId, req, res);
    await runOnSignedIn(userId);
    return SIGNED_IN;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    // Parse first: the throttle keys on the normalised email.
    @Body(new ZodBodyPipe(loginSchema)) { email, password }: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSuccess> {
    const ip = getClientIp(req);

    // Recorded as a failure up front, so parallel attempts count against each
    // other; withdrawn below if this one is refused or succeeds.
    const attempt = await this.throttle.recordLoginFailure(email, ip);
    const throttle = await this.throttle.checkLoginThrottle(email, ip, attempt);
    if (!throttle.allowed) {
      await this.throttle.withdrawLoginAttempt(attempt);
      throw tooManyRequests(
        MESSAGES.tooManyAttempts(throttle.retryAfterMinutes),
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    // An unknown email takes the same path as a wrong password: same Argon2
    // work, same failure records, same message.
    if (!user) await verifyDummy();
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedException({
        fieldErrors: { password: MESSAGES.wrongPassword },
      });
    }

    await this.throttle.clearLoginFailures(email);
    await this.throttle.withdrawLoginAttempt(attempt);
    await this.startSession(user.id, req, res);
    await runOnSignedIn(user.id);
    return SIGNED_IN;
  }

  /** A plain form POST works without JavaScript. There is no GET logout. */
  @Post("logout")
  @Redirect("/", HttpStatus.SEE_OTHER)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readSessionCookie(req);
    if (token) await this.sessions.invalidateSession(token);
    clearSessionCookie(res);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser): MeResponse {
    return user;
  }

  /**
   * Always a brand-new token (never one that came with the request), its hash
   * stored as the Session, the raw token only in the cookie. A session the
   * request already carried is ended first, so overwriting the cookie can't
   * leave a still-valid copy of the old token behind.
   */
  private async startSession(userId: string, req: Request, res: Response) {
    const previous = readSessionCookie(req);
    if (previous) await this.sessions.invalidateSession(previous);

    const token = generateSessionToken();
    await this.sessions.createSession(token, userId, {
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    });
    setSessionCookie(res, token);
  }
}
