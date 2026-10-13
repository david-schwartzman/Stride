import "reflect-metadata";

import { existsSync } from "node:fs";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

// Local dev reads apps/api/.env; Vercel injects env vars directly.
if (existsSync(".env")) process.loadEnvFile(".env");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
