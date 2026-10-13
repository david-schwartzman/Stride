import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@stride/shared";

import { PrismaService } from "../prisma/prisma.service";

const DB_TIMEOUT_MS = 2_000;

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    } catch {
      // Never echo the error: it can carry the connection string.
      const down: HealthResponse = { status: "error", db: "down" };
      throw new ServiceUnavailableException(down);
    }
    return { status: "ok", db: "ok" };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("db timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
