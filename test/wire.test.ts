import { describe, expect, test } from "vitest";
import { decodeBase64Json, encodeBase64Json, parse402, payToMatchesNetwork, CAIP2, JUNK_PAYMENT } from "../src/wire.js";
import { V1_BODY, V2_REQUIRED } from "./fixtures.js";

describe("base64 JSON", () => {
  test("round-trips the v2 spec example", () => {
    expect(decodeBase64Json(encodeBase64Json(V2_REQUIRED))).toEqual(V2_REQUIRED);
  });
  test("round-trips non-ASCII UTF-8", () => {
    const v = { description: "Market data \u{1F4C8} café" };
    expect(decodeBase64Json(encodeBase64Json(v))).toEqual(v);
  });
  test("throws on invalid base64 JSON", () => {
    expect(() => decodeBase64Json("%%%")).toThrow();
  });
});

describe("parse402", () => {
  test("detects v2 from the PAYMENT-REQUIRED header, case-insensitively", () => {
    const h = new Headers({ "payment-required": encodeBase64Json(V2_REQUIRED) });
    expect(parse402(h, "{}")).toEqual({ version: 2, requirements: V2_REQUIRED });
  });
  test("reports a decode error for a broken v2 header", () => {
    const r = parse402(new Headers({ "PAYMENT-REQUIRED": "not base64 json" }), "{}");
    expect(r.version).toBe(2);
    expect(r.requirements).toBeNull();
    expect(r.decodeError).toMatch(/base64/);
  });
  test("detects v1 from the JSON body", () => {
    expect(parse402(new Headers(), JSON.stringify(V1_BODY))).toEqual({ version: 1, requirements: V1_BODY });
  });
  test("returns null version when neither is present", () => {
    expect(parse402(new Headers(), "<html>pay</html>")).toEqual({ version: null, requirements: null });
  });
});

describe("address and network formats", () => {
  test("CAIP-2 accepts spec identifiers and rejects v1 names", () => {
    expect(CAIP2.test("eip155:84532")).toBe(true);
    expect(CAIP2.test("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(true);
    expect(CAIP2.test("base-sepolia")).toBe(false);
  });
  test("payTo format by namespace", () => {
    expect(payToMatchesNetwork("eip155:8453", "0x209693Bc6afc0C5328bA36FaF03C514EF312287C")).toBe(true);
    expect(payToMatchesNetwork("eip155:8453", "0x1234")).toBe(false);
    expect(payToMatchesNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")).toBe(true);
    expect(payToMatchesNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "0x209693Bc6afc0C5328bA36FaF03C514EF312287C")).toBe(false);
    expect(payToMatchesNetwork("stellar:pubnet", "GABC")).toBeNull();
  });
  test("junk payment is base64 that is not JSON", () => {
    expect(() => decodeBase64Json(JUNK_PAYMENT)).toThrow();
  });
});
