import { encodeBase64Json } from "../src/wire.js";

// Source: x402-foundation/x402 specs/transports-v2/http.md (main, pushed 2026-10-07)
export const V2_REQUIRED = {
  x402Version: 2,
  error: "PAYMENT-SIGNATURE header is required",
  resource: {
    url: "https://api.example.com/premium-data",
    description: "Access to premium market data",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      amount: "10000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
  ],
};

// Source: x402-foundation/x402 specs/x402-specification-v1.md section 5.1.1
export const V1_BODY = {
  x402Version: 1,
  error: "X-PAYMENT header is required",
  accepts: [
    {
      scheme: "exact",
      network: "base-sepolia",
      maxAmountRequired: "10000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      resource: "https://api.example.com/premium-data",
      description: "Access to premium market data",
      mimeType: "application/json",
      outputSchema: null,
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
  ],
};

export const TARGET = "https://api.example.com/premium-data";

export function v2Response(pr: unknown = V2_REQUIRED, headers: Record<string, string> = {}): Response {
  return new Response("{}", {
    status: 402,
    headers: { "Content-Type": "application/json", "PAYMENT-REQUIRED": encodeBase64Json(pr), ...headers },
  });
}

export function v1Response(body: unknown = V1_BODY, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function plain(status: number, headers: Record<string, string> = {}, body = ""): Response {
  return new Response(status === 204 || status === 304 ? null : body, { status, headers });
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
