// covers AC8 (auth-api-migration T1)
import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Ada@X.COM ")).toBe("ada@x.com");
  });

  it("leaves a normalised address unchanged", () => {
    expect(normalizeEmail("ada@x.com")).toBe("ada@x.com");
  });
});
