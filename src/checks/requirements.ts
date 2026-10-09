import { finding, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";
import { CAIP2, KNOWN_SCHEMES, payToMatchesNetwork } from "../wire.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function samePath(a: string, b: URL): boolean {
  try {
    const u = new URL(a);
    const strip = (p: string) => p.replace(/\/+$/, "") || "/";
    return u.origin === b.origin && strip(u.pathname) === strip(b.pathname);
  } catch {
    return false;
  }
}

export function checkRequirements(ctx: ProbeContext): Finding[] {
  if (ctx.first.status !== 402) return [];
  const { parsed } = ctx;
  if (parsed.decodeError) {
    return [finding("X03", "high", "PAYMENT-REQUIRED header cannot be decoded", parsed.decodeError,
      "Encode the PaymentRequired object as base64 JSON in the PAYMENT-REQUIRED header.")];
  }
  if (parsed.version === null || !isObj(parsed.requirements)) {
    return [finding("X03", "high", "402 response has no x402 payment requirements",
      "No PAYMENT-REQUIRED header and no JSON body with x402Version 1",
      "Send x402 v2 payment requirements in a base64 JSON PAYMENT-REQUIRED header.")];
  }
  const pr = parsed.requirements;
  const v2 = parsed.version === 2;
  const out: Finding[] = [];
  const high = (title: string, evidence: string, fix: string) => out.push(finding("X03", "high", title, evidence, fix));
  const medium = (title: string, evidence: string, fix: string) => out.push(finding("X03", "medium", title, evidence, fix));

  if (v2) {
    const resource = pr.resource;
    if (!isObj(resource) || !nonEmpty(resource.url)) {
      high("Missing resource.url", "PaymentRequired has no resource.url", "Add resource.url with the URL of the paid resource.");
    } else if (!samePath(resource.url, ctx.url)) {
      medium("resource.url does not match the checked URL", `resource.url is ${resource.url}, checked ${ctx.url.toString()}`,
        "Set resource.url to the URL clients request, so wallets show the right resource.");
    }
  }

  const accepts = pr.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    high("No payment options in accepts", "accepts is missing or empty", "List at least one PaymentRequirements object in accepts.");
    return out;
  }

  accepts.forEach((a: unknown, i: number) => {
    const at = `accepts[${i}]`;
    if (!isObj(a)) { high(`${at} is not an object`, JSON.stringify(a), "Each accepts entry must be a PaymentRequirements object."); return; }
    if (!nonEmpty(a.scheme)) high(`${at} has no scheme`, "scheme missing", `Set scheme to one of: ${KNOWN_SCHEMES.join(", ")}.`);
    else if (!(KNOWN_SCHEMES as readonly string[]).includes(a.scheme)) {
      medium(`${at} uses an unrecognized scheme`, `scheme is ${a.scheme}`, `Known schemes: ${KNOWN_SCHEMES.join(", ")}. Clients may not support others.`);
    }
    const network = a.network;
    if (!nonEmpty(network)) high(`${at} has no network`, "network missing", "Set network, for example eip155:8453 for Base.");
    else if (v2 && !CAIP2.test(network)) {
      high(`${at} network is not a CAIP-2 identifier`, `network is ${network}`, "In v2, use CAIP-2 identifiers such as eip155:8453 or solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp.");
    }
    const amountField = v2 ? "amount" : "maxAmountRequired";
    const amount = a[amountField];
    if (!(typeof amount === "string" && /^\d+$/.test(amount) && BigInt(amount) > 0n)) {
      high(`${at} amount (${amountField}) is missing or not a positive integer`, `${amountField} is ${JSON.stringify(amount)}`,
        `Set ${amountField} to the price in the asset's smallest unit, as a string of digits.`);
    }
    if (!nonEmpty(a.asset)) high(`${at} has no asset`, "asset missing", "Set asset to the token contract or mint address.");
    if (!nonEmpty(a.payTo)) high(`${at} has no payTo`, "payTo missing", "Set payTo to the address that receives payment.");
    else if (v2 && nonEmpty(network) && payToMatchesNetwork(network, a.payTo) === false) {
      high(`${at} payTo does not match the ${network.split(":")[0]} address format`, `payTo is ${a.payTo}`,
        "Check that payTo is a valid address for the network. A wrong address means payments go nowhere you control.");
    }
    if (!(typeof a.maxTimeoutSeconds === "number" && Number.isInteger(a.maxTimeoutSeconds) && a.maxTimeoutSeconds > 0)) {
      medium(`${at} maxTimeoutSeconds is missing or invalid`, `maxTimeoutSeconds is ${JSON.stringify(a.maxTimeoutSeconds)}`,
        "Set maxTimeoutSeconds to a positive integer, for example 60.");
    }
  });

  return out.length > 0 ? out : [ok("X03", "Payment requirements are complete and well-formed", `${accepts.length} payment option(s)`)];
}
