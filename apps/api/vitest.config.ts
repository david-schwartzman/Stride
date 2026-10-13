import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC (not esbuild) so Nest's decorator metadata is emitted in tests.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
