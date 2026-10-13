import "reflect-metadata";

import { existsSync } from "node:fs";

import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";

// Local dev reads apps/api/.env; Vercel injects env vars directly.
if (existsSync(".env")) process.loadEnvFile(".env");

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable("x-powered-by");
  // The auth module reads the session cookie from req.cookies.
  app.use(cookieParser());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
