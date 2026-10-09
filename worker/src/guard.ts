import { CheckError, type Fetcher } from "../../src/types.js";

export type Resolver = (hostname: string) => Promise<string[]>;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const BLOCKED_NAMES = /(^localhost$)|(\.localhost$)|(\.internal$)|(\.local$)/i;

export function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("fc") || v.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(v)) return true;
    if (v.startsWith("ff")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isBlockedIp(mapped[1]);
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
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_NAMES.test(host)) throw new CheckError("This host is not allowed", "blocked");
  const ips = IPV4.test(host) || host.includes(":") ? [host] : await resolve(host);
  if (ips.length === 0) throw new CheckError("Host does not resolve", "network");
  if (ips.some(isBlockedIp)) throw new CheckError("This host resolves to a private address", "blocked");
  return url;
}

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
