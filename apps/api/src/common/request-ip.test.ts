// covers AC9 (api-foundation T30)
import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { getClientIp } from "./request-ip";

const req = (headers: Record<string, string>) =>
  ({ headers, socket: { remoteAddress: "10.0.0.1" } }) as unknown as Request;

describe("getClientIp", () => {
  it("returns a valid IPv4 or IPv6 from x-stride-client-ip", () => {
    expect(getClientIp(req({ "x-stride-client-ip": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
    expect(getClientIp(req({ "x-stride-client-ip": "2001:db8::1" }))).toBe(
      "2001:db8::1",
    );
  });

  it("returns null for garbage, empty or missing values", () => {
    expect(getClientIp(req({ "x-stride-client-ip": "not-an-ip" }))).toBeNull();
    expect(getClientIp(req({ "x-stride-client-ip": "" }))).toBeNull();
    expect(getClientIp(req({}))).toBeNull();
  });

  it("never falls back to x-forwarded-for, x-real-ip or the socket", () => {
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
    expect(getClientIp(req({ "x-real-ip": "203.0.113.7" }))).toBeNull();
  });
});
