// covers AC4 (api-foundation T31)
// @vitest-environment node
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("next.config.ts", () => {
  it("has no /api rewrite: the web proxy owns /api (src/proxy.ts)", async () => {
    const rewrites = await nextConfig.rewrites?.();
    const all = !rewrites
      ? []
      : Array.isArray(rewrites)
        ? rewrites
        : [
            ...(rewrites.beforeFiles ?? []),
            ...(rewrites.afterFiles ?? []),
            ...(rewrites.fallback ?? []),
          ];
    expect(all.filter((r) => r.source.startsWith("/api"))).toEqual([]);
  });
});
