import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";

import { OriginCheckMiddleware } from "./common/origin-check.middleware";
import { ProxySecretMiddleware } from "./common/proxy-secret.middleware";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Order matters: the proxy-secret check runs before everything else,
    // so the origin check can trust x-stride-forwarded-host.
    consumer.apply(ProxySecretMiddleware, OriginCheckMiddleware).forRoutes("*");
  }
}
