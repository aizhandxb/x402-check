import { finding, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function checkTransport(ctx: ProbeContext): Finding[] {
  const out: Finding[] = [];
  if (ctx.url.protocol === "http:" && !LOCAL_HOSTS.has(ctx.url.hostname)) {
    out.push(finding("X06", "high", "Endpoint is served over plain HTTP", ctx.url.toString(),
      "Serve the endpoint over HTTPS. Payment headers must not travel in clear text."));
  }
  if (ctx.redirect?.crossHost) {
    out.push(finding("X06", "high", "Redirects to a different host", `${ctx.redirect.from} -> ${ctx.redirect.to}`,
      "Serve the 402 from the requested host. Clients may resend payment headers to the redirect target."));
  }
  if (ctx.redirect?.downgrade) {
    out.push(finding("X06", "high", "Redirects to plain HTTP", `${ctx.redirect.from} -> ${ctx.redirect.to}`,
      "Keep the payment endpoint on HTTPS; never redirect paid routes to http."));
  }
  return out.length > 0 ? out : [ok("X06", "HTTPS and no cross-host redirect", ctx.url.protocol)];
}
