import { expect, test } from "vitest";
import { main } from "../src/cli.js";
import type { Fetcher } from "../src/types.js";
import { plain, TARGET, v2Response } from "./fixtures.js";

function io(responses: Response[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const fetch: Fetcher = async () => {
    const r = responses.shift();
    if (!r) throw new TypeError("fetch failed");
    return r;
  };
  return { out, err, io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s), fetch } };
}

test("--help prints usage and exits 0 without network", async () => {
  const t = io();
  expect(await main(["--help"], t.io)).toBe(0);
  expect(t.out.join("\n")).toMatch(/Usage: x402-check <url>/);
});
test("--version prints the version", async () => {
  const t = io();
  expect(await main(["--version"], t.io)).toBe(0);
  expect(t.out[0]).toMatch(/^\d+\.\d+\.\d+$/);
});
test("missing url exits 2", async () => {
  expect(await main([], io().io)).toBe(2);
});
test("bad method and bad timeout exit 2", async () => {
  expect(await main([TARGET, "--method", "PUT"], io().io)).toBe(2);
  expect(await main([TARGET, "--timeout", "abc"], io().io)).toBe(2);
});
test("healthy endpoint exits 0 and prints a readable report", async () => {
  const t = io([v2Response(undefined, { "cache-control": "no-store" }), plain(402)]);
  expect(await main([TARGET], t.io)).toBe(0);
  const text = t.out.join("\n");
  expect(text).toMatch(/x402-check https:\/\/api\.example\.com\/premium-data/);
  expect(text).toMatch(/\[INFO\] X01 OK:/);
  expect(text).toMatch(/agentic-payment-security-audit/);
});
test("ungated endpoint exits 1", async () => {
  expect(await main([TARGET], io([plain(200)]).io)).toBe(1);
});
test("--json prints one parseable CheckReport", async () => {
  const t = io([plain(200)]);
  await main([TARGET, "--json"], t.io);
  const report = JSON.parse(t.out.join("\n"));
  expect(report.findings[0].id).toBe("X01");
});
test("network error exits 2 with a message", async () => {
  const t = io([]);
  expect(await main([TARGET], t.io)).toBe(2);
  expect(t.err.join("\n")).toMatch(/error: Request failed/);
});
