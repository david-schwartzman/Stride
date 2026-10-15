import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { OriginCheckMiddleware } from "./common/origin-check.middleware";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, HealthModule, AuthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // The proxy-secret check isn't here: it runs earlier, as the first Express
    // middleware, before body parsing (setup-app.ts). So by now the
    // x-stride-forwarded-host header the origin check reads is trusted.
    consumer.apply(OriginCheckMiddleware).forRoutes("*");
  }
}
