// covers AC4 (auth-api-migration T2; ported from apps/web/src/lib/request-ip.test.ts)
import { describe, expect, it } from "vitest";

import { ipThrottleBucket } from "./ip-bucket";

describe("ipThrottleBucket", () => {
  it("keeps IPv4 exact", () => {
    expect(ipThrottleBucket("203.0.113.7")).toBe("203.0.113.7");
  });

  it.each([
    ["2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64"],
    ["2001:db8:1:2::1", "2001:db8:1:2::/64"],
    ["2001:DB8:0001:0002::ffff", "2001:db8:1:2::/64"],
    ["2001:db8::", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["2001:db8:1:2::1.2.3.4", "2001:db8:1:2::/64"],
  ])("cuts IPv6 %s to its /64", (ip, bucket) => {
    expect(ipThrottleBucket(ip)).toBe(bucket);
  });

  it("puts two addresses in the same /64 in one bucket, and other /64s apart", () => {
    const a = ipThrottleBucket("2001:db8:1:2::1");
    expect(ipThrottleBucket("2001:db8:1:2:ffff::42")).toBe(a);
    expect(ipThrottleBucket("2001:db8:1:3::1")).not.toBe(a);
  });

  it("treats IPv4-mapped IPv6 as the IPv4 address", () => {
    expect(ipThrottleBucket("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipThrottleBucket("::ffff:cb00:7107")).toBe("203.0.113.7");
  });
});
