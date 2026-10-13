// covers AC8 (auth-api-migration T1)
import { describe, expect, it } from "vitest";

import { MESSAGES } from "./messages";

describe("MESSAGES", () => {
  it("keeps the shipped wording", () => {
    expect(MESSAGES.emailTaken).toBe(
      "An account with this email already exists. Log in instead.",
    );
    expect(MESSAGES.wrongPassword).toBe(
      "That password isn't right. Try again.",
    );
    expect(MESSAGES.signupLimit).toBe(
      "Too many sign-ups from this network. Try again later.",
    );
  });

  it("uses the singular for one minute", () => {
    expect(MESSAGES.tooManyAttempts(1)).toBe(
      "Too many attempts, try again in 1 minute.",
    );
  });

  it("uses the plural for several minutes", () => {
    expect(MESSAGES.tooManyAttempts(15)).toBe(
      "Too many attempts, try again in 15 minutes.",
    );
  });
});
