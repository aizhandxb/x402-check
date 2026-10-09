import type { Parsed402 } from "./types.js";

export const KNOWN_SCHEMES = ["exact", "upto", "batch-settlement", "auth-capture"] as const;
export const CAIP2 = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const JUNK_PAYMENT = btoa("not-a-payment");

export function encodeBase64Json(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeBase64Json(value: string): unknown {
  const bin = atob(value.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function payToMatchesNetwork(network: string, payTo: string): boolean | null {
  if (network.startsWith("eip155:")) return EVM_ADDRESS.test(payTo);
  if (network.startsWith("solana:")) return SOLANA_ADDRESS.test(payTo);
  return null;
}

export function parse402(headers: Headers, bodyText: string): Parsed402 {
  const header = headers.get("payment-required");
  if (header !== null) {
    try {
      return { version: 2, requirements: decodeBase64Json(header) };
    } catch {
      return { version: 2, requirements: null, decodeError: "PAYMENT-REQUIRED header is not base64-encoded JSON" };
    }
  }
  try {
    const body: unknown = JSON.parse(bodyText);
    if (typeof body === "object" && body !== null && (body as { x402Version?: unknown }).x402Version === 1) {
      return { version: 1, requirements: body };
    }
  } catch {
    // not JSON: fall through
  }
  return { version: null, requirements: null };
}
