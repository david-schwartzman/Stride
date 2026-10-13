// covers AC6 (api-foundation T31)
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
  ])("rejects %s outside the allowed files", async (_name, code) => {
    for (const file of [
      "src/features/cart/actions.ts",
      "src/app/page.tsx",
      "src/lib/api-client.ts",
    ]) {
      expect(
        await restrictedImportErrors(`${code}\nvoid 0;\n`, file),
      ).toHaveLength(1);
    }
  });

  it.each([
    "src/lib/db.ts",
    "src/lib/auth/session.ts",
    "src/features/auth/actions.ts",
    "src/features/auth/actions.test.ts",
  ])(
    "allows @prisma/client in %s (temporary, auth-api-migration)",
    async (file) => {
      expect(
        await restrictedImportErrors(
          'import { PrismaClient } from "@prisma/client";\nvoid 0;\n',
          file,
        ),
      ).toEqual([]);
    },
  );
});
