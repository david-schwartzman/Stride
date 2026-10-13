// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getClientIp } from "./request-ip";

describe("getClientIp", () => {
  it.each(["203.0.113.7", "2001:db8::1"])(
    "returns a valid x-real-ip (%s)",
    (ip) => {
      expect(getClientIp(new Headers({ "x-real-ip": ip }))).toBe(ip);
    },
  );

  it("trims surrounding whitespace", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 203.0.113.7 " }))).toBe(
      "203.0.113.7",
    );
  });

  it.each([
    ["missing", {}],
    ["empty", { "x-real-ip": "" }],
    ["garbage", { "x-real-ip": "not-an-ip" }],
    ["a list", { "x-real-ip": "203.0.113.7, 198.51.100.1" }],
  ])("returns null when x-real-ip is %s", (_label, headers) => {
    expect(getClientIp(new Headers(headers))).toBeNull();
  });

  it("ignores a spoofed x-forwarded-for", () => {
    expect(
      getClientIp(new Headers({ "x-forwarded-for": "198.51.100.1" })),
    ).toBeNull();
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "198.51.100.1",
          "x-real-ip": "203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });
});
