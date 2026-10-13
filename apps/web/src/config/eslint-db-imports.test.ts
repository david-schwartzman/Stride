// covers AC6 (api-foundation T31); auth-api-migration AC11 (T23)
// @vitest-environment node
import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: path.resolve(__dirname, "../..") });

async function restrictedImportErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter(
    (m) => m.ruleId === "no-restricted-imports" && m.severity === 2,
  );
}

describe("no-restricted-imports for the database (eslint.config.mjs)", () => {
  it.each([
    ["@prisma/client", 'import { PrismaClient } from "@prisma/client";'],
    ["@/lib/db", 'import { db } from "@/lib/db";'],
  ])("rejects %s anywhere in apps/web", async (_name, code) => {
    for (const file of [
      "src/features/cart/actions.ts",
      "src/app/page.tsx",
      "src/lib/api-client.ts",
      // The former auth-api-migration exception is gone (its AC11).
      "src/lib/db.ts",
      "src/lib/auth/session.ts",
      "src/features/auth/actions.ts",
      "src/features/auth/actions.test.ts",
    ]) {
      expect(
        await restrictedImportErrors(`${code}\nvoid 0;\n`, file),
      ).toHaveLength(1);
    }
  });
});
