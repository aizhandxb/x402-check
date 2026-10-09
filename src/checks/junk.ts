import { finding, info, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";

export function checkJunkPayment(ctx: ProbeContext): Finding[] {
  if (!ctx.junk) return [];
  const header = ctx.parsed.version === 1 ? "X-PAYMENT" : "PAYMENT-SIGNATURE";
  const s = ctx.junk.status;
  if (s >= 200 && s < 300) {
    return [finding("X04", "critical", "Accepts a malformed payment header", `Request with a junk ${header} returned HTTP ${s}`,
      "Decode the payment payload and verify it with your facilitator (/verify) before serving. Reject anything that fails.")];
  }
  if (s === 400 || s === 402) return [ok("X04", "Rejects a malformed payment header", `Junk ${header} returned HTTP ${s}`)];
  return [info("X04", "Unexpected response to a malformed payment header", `Junk ${header} returned HTTP ${s}`,
    "Expected 400 (spec) or 402 (reference server). Check that payment parsing errors are handled, not crashing the route.")];
}
