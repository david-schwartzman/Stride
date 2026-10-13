// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const onSignedIn = vi.hoisted(() => vi.fn());
vi.mock("./hooks", () => ({ onSignedIn }));

import { runOnSignedIn } from "./run-on-signed-in";

describe("runOnSignedIn", () => {
  afterEach(() => {
    onSignedIn.mockReset();
    vi.restoreAllMocks();
  });

  it("calls onSignedIn once with the user id", async () => {
    await runOnSignedIn("user_1");

    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledWith("user_1");
  });

  it("swallows a throwing hook and logs only the user id and error", async () => {
    const error = new Error("merge failed");
    onSignedIn.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runOnSignedIn("user_1")).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual([
      "onSignedIn failed",
      { userId: "user_1", error },
    ]);
  });
});
