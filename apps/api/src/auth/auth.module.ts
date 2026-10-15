import { Module, type OnModuleInit } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { getPepper } from "./password.service";
import { SessionService } from "./session.service";
import { ThrottleService } from "./throttle.service";

/** Sign-up, login, logout and /auth/me; other modules protect routes with AuthGuard. */
@Module({
  controllers: [AuthController],
  providers: [AuthGuard, SessionService, ThrottleService],
  exports: [AuthGuard, SessionService],
})
export class AuthModule implements OnModuleInit {
  onModuleInit() {
    // Fail boot on a missing or weak pepper rather than at the first sign-in (AC12).
    getPepper();
  }
}
