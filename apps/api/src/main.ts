import "reflect-metadata";

import { existsSync } from "node:fs";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { setupApp } from "./setup-app";

// Local dev reads apps/api/.env; Vercel injects env vars directly.
if (existsSync(".env")) process.loadEnvFile(".env");

async function bootstrap() {
  // Body parsing is ours: it runs after the proxy-secret check and never
  // echoes a malformed body (setup-app.ts).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
