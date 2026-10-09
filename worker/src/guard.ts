import { CheckError, type Fetcher } from "../../src/types.js";

export type Resolver = (hostname: string) => Promise<string[]>;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const BLOCKED_NAMES = /(^localhost$)|(\.localhost$)|(\.internal$)|(\.local$)/i;

/** Parses an IPv6 literal into eight 16-bit groups. Returns null for zone IDs or malformed input. */
function parseIpv6(text: string): number[] | null {
  if (text.includes("%")) return null;
  let head = text;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const octets = tail.split(".");
    if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o) || Number(o) > 255)) return null;
    const [a, b, c, d] = octets.map(Number) as [number, number, number, number];
    head = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const parseGroups = (s: string): number[] | null => {
    if (s === "") return [];
    const out: number[] = [];
    for (const p of s.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
      out.push(parseInt(p, 16));
    }
    return out;
  };
  const halves = head.split("::");
  if (halves.length > 2) return null;
  if (halves.length === 2) {
    const left = parseGroups(halves[0] ?? "");
    const right = parseGroups(halves[1] ?? "");
    if (!left || !right) return null;
    const fill = 8 - left.length - right.length;
    if (fill < 1) return null;
    return [...left, ...new Array<number>(fill).fill(0), ...right];
  }
  const all = parseGroups(head);
  return all && all.length === 8 ? all : null;
}

export function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v.includes(":")) {
    const g = parseIpv6(v);
    if (!g) return true;
    const hi = g[6] ?? 0;
    const lo = g[7] ?? 0;
    const embedded = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    const zeroFirst = (n: number) => g.slice(0, n).every((x) => x === 0);
    if (zeroFirst(8)) return true; // ::
    if (zeroFirst(7) && lo === 1) return true; // ::1
    if (zeroFirst(5) && g[5] === 0xffff) return isBlockedIp(embedded); // ::ffff:a.b.c.d (mapped)
    if (zeroFirst(4) && g[4] === 0xffff && g[5] === 0) return isBlockedIp(embedded); // ::ffff:0:a.b.c.d
    if (zeroFirst(6)) return isBlockedIp(embedded); // ::a.b.c.d (compatible)
    const first = g[0] ?? 0;
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8
    return false;
  }
  if (!IPV4.test(v)) return true;
  const parts = v.split(".").map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export async function assertPublicUrl(raw: string, resolve: Resolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CheckError("Not a valid URL", "invalid_url");
  }
  if (url.protocol !== "https:") throw new CheckError("Only https:// URLs can be checked here", "invalid_url");
  if (url.username || url.password) throw new CheckError("URLs with credentials are not allowed", "invalid_url");
  if (url.port && url.port !== "443") throw new CheckError("Only the default HTTPS port can be checked here", "blocked");
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (BLOCKED_NAMES.test(host)) throw new CheckError("This host is not allowed", "blocked");
  const ips = IPV4.test(host) || host.includes(":") ? [host] : await resolve(host);
  if (ips.length === 0) throw new CheckError("Host does not resolve", "network");
  if (ips.some(isBlockedIp)) throw new CheckError("This host resolves to a private address", "blocked");
  return url;
}

// Known limitation: DNS rebinding can still change the answer between the DoH check above and the
// fetch itself. Workers cannot route to RFC 1918 or loopback addresses, so this guard is defense in depth.
export function guardedFetch(inner: Fetcher, resolve: Resolver): Fetcher {
  return async (input, init) => {
    await assertPublicUrl(input, resolve);
    return inner(input, { ...init, redirect: "manual" });
  };
}

export function dohResolver(fetchImpl: Fetcher): Resolver {
  return async (hostname) => {
    const out: string[] = [];
    for (const type of ["A", "AAAA"] as const) {
      const res = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, {
        headers: { accept: "application/dns-json" },
      });
      if (!res.ok) throw new CheckError("DNS lookup failed", "network");
      const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
      for (const a of data.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(a.data);
    }
    return out;
  };
}
