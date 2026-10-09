import { finding, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";

export function checkCache(ctx: ProbeContext): Finding[] {
  const h = ctx.first.headers;
  const age = Number(h.get("age") ?? "0");
  const cf = (h.get("cf-cache-status") ?? "").toUpperCase();
  const xCache = (h.get("x-cache") ?? "").toUpperCase();
  const hit = (Number.isFinite(age) && age > 0) || cf === "HIT" || xCache.includes("HIT");
  const cc = (h.get("cache-control") ?? "").toLowerCase();
  const noStore = cc.includes("no-store") || cc.includes("private");
  const evidence = `cache-control: ${cc || "(none)"}; age: ${h.get("age") ?? "(none)"}; cf-cache-status: ${cf || "(none)"}; x-cache: ${xCache || "(none)"}`;
  if (hit && !noStore) {
    return [finding("X05", "high", "A CDN is caching this payment-gated path", evidence,
      "Send Cache-Control: private, no-store on the 402 and on paid responses, add a CDN bypass rule for this path, then confirm paid responses are never served from cache.")];
  }
  if (hit) {
    return [finding("X05", "medium", "CDN reports a cache hit despite no-store", evidence,
      "A CDN rule is overriding your Cache-Control on this path. Add a bypass rule.")];
  }
  if (!noStore) {
    return [finding("X05", "low", "No Cache-Control: no-store on the payment path", evidence,
      "Add Cache-Control: private, no-store so no proxy or CDN can cache paid content.")];
  }
  return [ok("X05", "Cache headers forbid shared caching", evidence)];
}
