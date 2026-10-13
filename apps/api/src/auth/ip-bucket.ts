import { isIPv4 } from "node:net";

// Ported unchanged from apps/web/src/lib/request-ip.ts (auth-api-migration AC4).

/**
 * The key per-IP throttles count under, for an IP from getClientIp (common/request-ip.ts). IPv4 stays
 * exact; IPv6 is cut to its /64, the smallest block one client (a home line, a
 * cloud VM) gets, so rotating addresses inside it doesn't reset the counter.
 * IPv4-mapped IPv6 (`::ffff:a.b.c.d`) counts as the IPv4 address.
 */
export function ipThrottleBucket(ip: string): string {
  if (isIPv4(ip)) return ip;

  const groups = expandIPv6(ip);
  const isMapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMapped) {
    const [hi, lo] = [groups[6], groups[7]];
    return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}

/** The eight 16-bit groups of a valid IPv6 address. */
function expandIPv6(ip: string): number[] {
  let address = ip.toLowerCase().split("%")[0];

  // A trailing dotted IPv4 part becomes the last two groups.
  const dotted = address.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    address =
      address.slice(0, -dotted[0].length) +
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head, tail] = address.split("::");
  const split = (part: string) => (part ? part.split(":") : []);
  const parts =
    tail === undefined
      ? split(head)
      : [
          ...split(head),
          ...Array<string>(8 - split(head).length - split(tail).length).fill(
            "0",
          ),
          ...split(tail),
        ];
  return parts.map((part) => parseInt(part, 16));
}
