import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";

import { ProxySecretMiddleware } from "./common/proxy-secret.middleware";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Order matters: the proxy-secret check runs before everything else.
    consumer.apply(ProxySecretMiddleware).forRoutes("*");
  }
}
