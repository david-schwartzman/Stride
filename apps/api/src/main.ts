import "reflect-metadata";

import { existsSync } from "node:fs";

import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { useSafeBodyParsing } from "./auth/body-parsing";

// Local dev reads apps/api/.env; Vercel injects env vars directly.
if (existsSync(".env")) process.loadEnvFile(".env");

async function bootstrap() {
  // Body parsing is ours, so a malformed body is never echoed (auth/body-parsing.ts).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.disable("x-powered-by");
  useSafeBodyParsing(app);
  // The auth module reads the session cookie from req.cookies.
  app.use(cookieParser());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
