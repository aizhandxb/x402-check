import { finding, info, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";

export function checkCors(ctx: ProbeContext): Finding[] {
  if (ctx.parsed.version !== 2) return [];
  const h = ctx.first.headers;
  const acao = h.get("access-control-allow-origin");
  if (!acao) {
    return [info("X07", "No CORS headers", "Access-Control-Allow-Origin not set",
      "Fine for server-side agents. If browser clients must read payment headers, enable CORS and expose PAYMENT-REQUIRED and PAYMENT-RESPONSE.")];
  }
  const expose = (h.get("access-control-expose-headers") ?? "").toLowerCase();
  const wildcard = expose.split(",").some((t) => t.trim() === "*");
  const missing = wildcard ? [] : ["payment-required", "payment-response"].filter((name) => !expose.includes(name));
  if (missing.length > 0) {
    return [finding("X07", "low", "CORS does not expose payment headers", `Access-Control-Expose-Headers: ${expose || "(none)"}`,
      "Add PAYMENT-REQUIRED and PAYMENT-RESPONSE to Access-Control-Expose-Headers so browser agents can read them. This is a recommendation; the x402 spec does not cover CORS.")];
  }
  return [ok("X07", "CORS exposes payment headers", `Access-Control-Expose-Headers: ${expose}`)];
}
