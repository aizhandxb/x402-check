import { finding, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";

export function checkPaymentGate(ctx: ProbeContext): Finding[] {
  const s = ctx.first.status;
  if (s === 402) return [ok("X01", "Unpaid request returns 402 Payment Required", `HTTP ${s}`)];
  if (s >= 200 && s < 300) {
    return [finding("X01", "critical", "Content is served without payment", `Unpaid request returned HTTP ${s}`,
      "Gate the route with x402 middleware so unpaid requests get HTTP 402 with a PAYMENT-REQUIRED header.")];
  }
  return [finding("X01", "medium", `Unpaid request returned HTTP ${s}, not 402`, `HTTP ${s}`,
    "Return HTTP 402 with payment requirements for unpaid requests. If the route needs a body or another method, re-run with --method POST.")];
}

export function checkSpecVersion(ctx: ProbeContext): Finding[] {
  if (ctx.first.status !== 402) return [];
  if (ctx.parsed.version === 2) return [ok("X02", "Uses x402 v2 (PAYMENT-REQUIRED header)", "PAYMENT-REQUIRED header present")];
  if (ctx.parsed.version === 1) {
    return [finding("X02", "medium", "Uses x402 v1", "402 body has x402Version 1 and there is no PAYMENT-REQUIRED header",
      "Migrate to x402 v2: send requirements as base64 JSON in a PAYMENT-REQUIRED header and accept PAYMENT-SIGNATURE. Serve both during the migration if you have v1 clients.")];
  }
  return [];
}
