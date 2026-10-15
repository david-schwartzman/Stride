// covers AC2, AC3, AC13 (auth-api-migration T2; ported from apps/web/src/features/auth/run-on-signed-in.test.ts)
import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runOnSignedIn, signInHooks } from "./on-signed-in";

describe("runOnSignedIn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onSignedIn once with the user id", async () => {
    const hook = vi.spyOn(signInHooks, "onSignedIn");

    await runOnSignedIn("user_1");

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith("user_1");
  });

  it("swallows a throwing hook and logs only the user id and error", async () => {
    const error = new Error("merge failed");
    vi.spyOn(signInHooks, "onSignedIn").mockRejectedValue(error);
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await expect(runOnSignedIn("user_1")).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual([
      "onSignedIn failed for user user_1",
      error.stack,
    ]);
  });

  it("logs a non-Error throw without a stack", async () => {
    vi.spyOn(signInHooks, "onSignedIn").mockRejectedValue("boom");
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await runOnSignedIn("user_1");

    expect(log.mock.calls[0]).toEqual([
      "onSignedIn failed for user user_1: boom",
    ]);
  });
});
