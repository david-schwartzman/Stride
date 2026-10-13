import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // The web app talks to the database only through the API (api-foundation
  // AC6). TEMPORARY exception: the signup-login auth code below still uses
  // Prisma here; candidate spec `auth-api-migration` moves it into the API and
  // removes the override.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prisma/client",
                "@prisma/client/*",
                "@/lib/db",
                "**/lib/db",
                "./db",
                "../db",
              ],
              message:
                "apps/web must not use the database directly: call the API (apiFetch or /api).",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/lib/db.ts",
      "src/lib/auth/**",
      "src/features/auth/actions.ts",
      "src/features/auth/actions.test.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design reference bundle and agent worktrees are not app code.
    "stride-design/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
