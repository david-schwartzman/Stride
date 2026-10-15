// covers AC1, AC12 (auth-api-migration T2/T17)
import { randomBytes } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

const SHORT = randomBytes(16).toString("base64");

// password.service.ts caches the pepper, so each case loads fresh modules.
// Dynamic imports need the .js extension here.
async function initAuthModule(pepper: string | undefined) {
  vi.resetModules();
  vi.stubEnv("PASSWORD_PEPPER", pepper);
  const { AuthModule } = await import("./auth.module.js");
  const { PrismaModule } = await import("../prisma/prisma.module.js");
  const { PrismaService } = await import("../prisma/prisma.service.js");
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  return moduleRef.init();
}

describe("AuthModule", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts with a valid pepper and serves the auth controller", async () => {
    const app = await initAuthModule(randomBytes(32).toString("base64"));
    const { AuthController } = await import("./auth.controller.js");

    expect(app.get(AuthController)).toBeInstanceOf(AuthController);
    await app.close();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["shorter than 32 bytes", SHORT],
  ])(
    "refuses to start when the pepper is %s, without the value in the error",
    async (_label, pepper) => {
      const error = await initAuthModule(pepper).then(
        () => expect.unreachable("expected init to throw"),
        (e: unknown) => e as Error,
      );

      expect(error.message).toMatch(/PASSWORD_PEPPER/);
      if (pepper) {
        expect(error.message).not.toContain(pepper);
        expect(error.stack).not.toContain(pepper);
      }
    },
  );

  it("is imported by AppModule", async () => {
    vi.resetModules();
    const { AppModule } = await import("../app.module.js");
    const { AuthModule } = await import("./auth.module.js");

    expect(Reflect.getMetadata("imports", AppModule)).toContain(AuthModule);
  });
});
