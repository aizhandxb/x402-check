import { checkCache } from "./checks/cache.js";
import { checkCors } from "./checks/cors.js";
import { checkDiscovery } from "./checks/discovery.js";
import { checkPaymentGate, checkSpecVersion } from "./checks/gate.js";
import { checkJunkPayment } from "./checks/junk.js";
import { checkRequirements } from "./checks/requirements.js";
import { checkTransport } from "./checks/transport.js";
import { sortFindings } from "./findings.js";
import { toSnapshot } from "./http.js";
import { CheckError, USER_AGENT, type CheckOptions, type CheckReport, type ProbeContext, type Snapshot } from "./types.js";
import { JUNK_PAYMENT, parse402 } from "./wire.js";

export async function checkEndpoint(rawUrl: string, opts: CheckOptions): Promise<CheckReport> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CheckError("Not a valid URL", "invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new CheckError("Only http(s) URLs can be checked", "invalid_url");

  const method = opts.method ?? "GET";
  const maxBody = opts.maxBodyBytes ?? 262_144;
  const deadline = Date.now() + (opts.timeoutMs ?? 10_000);
  let requestsMade = 0;

  const send = async (target: URL, extra: Record<string, string> = {}): Promise<Snapshot> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new CheckError("Timed out", "timeout");
    requestsMade++;
    const headers: Record<string, string> = { Accept: "application/json", "User-Agent": USER_AGENT, ...extra };
    if (method === "POST") headers["Content-Type"] = "application/json";
    try {
      const res = await opts.fetch(target.toString(), {
        method,
        redirect: "manual",
        headers,
        body: method === "POST" ? "{}" : undefined,
        signal: AbortSignal.timeout(remaining),
      });
      return await toSnapshot(res, maxBody);
    } catch (e) {
      if (e instanceof CheckError) throw e;
      const name = (e as { name?: string } | null)?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new CheckError("Timed out", "timeout");
      throw new CheckError(`Request failed: ${(e as Error)?.message ?? String(e)}`, "network");
    }
  };

  let target = url;
  let first = await send(target);
  let redirect: ProbeContext["redirect"];
  const location = first.headers.get("location");
  if (first.status >= 300 && first.status < 400 && location) {
    const to = new URL(location, target);
    const crossHost = to.host !== target.host;
    redirect = { from: target.toString(), to: to.toString(), crossHost };
    if (!crossHost) {
      target = to;
      first = await send(target);
    }
  }

  const parsed = parse402(first.headers, first.bodyText);
  let junk: Snapshot | undefined;
  if (first.status === 402) {
    const header = parsed.version === 1 ? "X-PAYMENT" : "PAYMENT-SIGNATURE";
    junk = await send(target, { [header]: JUNK_PAYMENT });
  }

  const ctx: ProbeContext = { url: target, first, parsed, junk, redirect };
  const findings = sortFindings([
    ...checkTransport(ctx),
    ...checkPaymentGate(ctx),
    ...checkSpecVersion(ctx),
    ...checkRequirements(ctx),
    ...checkJunkPayment(ctx),
    ...checkCache(ctx),
    ...checkCors(ctx),
    ...checkDiscovery(ctx),
  ]);
  return {
    url: url.toString(),
    checkedAt: (opts.now?.() ?? new Date()).toISOString(),
    specVersion: parsed.version,
    findings,
    requestsMade,
  };
}
