import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  prettier,
  globalIgnores(["dist/**"]),
]);
