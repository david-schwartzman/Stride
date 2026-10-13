import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Boot even when the DB is down, so /health can answer 503 instead of the
    // process crashing. Prisma reconnects lazily on the next query. The error
    // isn't logged: it can carry the connection string.
    await this.$connect().catch(() =>
      this.logger.warn("Database unreachable at startup"),
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
