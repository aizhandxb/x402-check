import { describe, expect, test } from "vitest";
import { checkEndpoint } from "../src/check-endpoint.js";
import { CheckError, USER_AGENT, type Fetcher } from "../src/types.js";
import { JUNK_PAYMENT } from "../src/wire.js";
import { plain, TARGET, v1Response, v2Response } from "./fixtures.js";

function scripted(responses: Response[]): Fetcher & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error("unexpected extra request");
    return r;
  }) as Fetcher & { calls: typeof calls };
  f.calls = calls;
  return f;
}
const hdr = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);
const fixed = () => new Date("2026-10-09T00:00:00Z");

describe("checkEndpoint", () => {
  test("healthy v2 endpoint: 2 requests, junk PAYMENT-SIGNATURE, JSON accept and our UA", async () => {
    const f = scripted([v2Response(undefined, { "cache-control": "no-store" }), plain(402)]);
    const r = await checkEndpoint(TARGET, { fetch: f, now: fixed });
    expect(r.requestsMade).toBe(2);
    expect(r.specVersion).toBe(2);
    expect(r.checkedAt).toBe("2026-10-09T00:00:00.000Z");
    expect(hdr(f.calls[0]?.init, "accept")).toBe("application/json");
    expect(hdr(f.calls[0]?.init, "user-agent")).toBe(USER_AGENT);
    expect(f.calls[0]?.init?.redirect).toBe("manual");
    expect(hdr(f.calls[1]?.init, "payment-signature")).toBe(JUNK_PAYMENT);
    expect(r.findings.some((x) => x.severity === "critical" || x.severity === "high")).toBe(false);
  });

  test("v1 endpoint gets a junk X-PAYMENT", async () => {
    const f = scripted([v1Response(), plain(402)]);
    await checkEndpoint(TARGET, { fetch: f });
    expect(hdr(f.calls[1]?.init, "x-payment")).toBe(JUNK_PAYMENT);
  });

  test("ungated content: 1 request, critical first", async () => {
    const f = scripted([plain(200, {}, "data")]);
    const r = await checkEndpoint(TARGET, { fetch: f });
    expect(r.requestsMade).toBe(1);
    expect(r.findings[0]).toMatchObject({ id: "X01", severity: "critical" });
  });

  test("follows one same-host redirect and never more (3 requests max)", async () => {
    const f = scripted([
      plain(301, { location: "/premium-data/" }),
      v2Response(undefined, { "cache-control": "no-store" }),
      plain(402),
    ]);
    const r = await checkEndpoint(TARGET, { fetch: f });
    expect(r.requestsMade).toBe(3);
    expect(f.calls[1]?.url).toBe("https://api.example.com/premium-data/");
  });

  test("a second redirect is not followed", async () => {
    const f = scripted([plain(302, { location: "/a" }), plain(302, { location: "/b" })]);
    const r = await checkEndpoint(TARGET, { fetch: f });
    expect(r.requestsMade).toBe(2);
    expect(r.findings.find((x) => x.id === "X01")?.severity).toBe("medium");
  });

  test("cross-host redirect is reported and not followed", async () => {
    const f = scripted([plain(302, { location: "https://evil.example/x" })]);
    const r = await checkEndpoint(TARGET, { fetch: f });
    expect(r.requestsMade).toBe(1);
    expect(r.findings.some((x) => x.id === "X06" && x.severity === "high")).toBe(true);
  });

  test("same-host https to http redirect is reported as X06 and not followed", async () => {
    const f = scripted([plain(301, { location: "http://api.example.com/x" })]);
    const r = await checkEndpoint(TARGET, { fetch: f });
    expect(r.requestsMade).toBe(1);
    expect(r.findings.some((x) => x.id === "X06" && x.severity === "high" && /plain HTTP/.test(x.title))).toBe(true);
  });

  test("POST sends an empty JSON body", async () => {
    const f = scripted([plain(200)]);
    await checkEndpoint(TARGET, { fetch: f, method: "POST" });
    expect(f.calls[0]?.init?.method).toBe("POST");
    expect(f.calls[0]?.init?.body).toBe("{}");
  });

  test("invalid URL throws invalid_url", async () => {
    await expect(checkEndpoint("not a url", { fetch: scripted([]) })).rejects.toMatchObject({ code: "invalid_url" });
    await expect(checkEndpoint("ftp://x.example", { fetch: scripted([]) })).rejects.toBeInstanceOf(CheckError);
  });

  test("network failure throws network", async () => {
    const f: Fetcher = async () => { throw new TypeError("fetch failed"); };
    await expect(checkEndpoint(TARGET, { fetch: f })).rejects.toMatchObject({ code: "network" });
  });

  test("timeout throws timeout", async () => {
    const f: Fetcher = (_u, init) => new Promise((_r, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
    await expect(checkEndpoint(TARGET, { fetch: f, timeoutMs: 50 })).rejects.toMatchObject({ code: "timeout" });
  });

  test("CheckError from an injected fetch (guard) passes through unchanged", async () => {
    const f: Fetcher = async () => { throw new CheckError("private", "blocked"); };
    await expect(checkEndpoint(TARGET, { fetch: f })).rejects.toMatchObject({ code: "blocked" });
  });

  test("stalled body is bounded by the budget even if the fetcher ignores the signal", async () => {
    const f: Fetcher = async () => new Response(new ReadableStream({ start() {} }), { status: 402 });
    const t0 = Date.now();
    await expect(checkEndpoint(TARGET, { fetch: f, timeoutMs: 50 })).rejects.toMatchObject({ code: "timeout" });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  test("malformed Location does not throw a raw error", async () => {
    const f = scripted([plain(302, { location: "http://[" })]);
    const r = await checkEndpoint(TARGET, { fetch: f });
    expect(r.requestsMade).toBe(1);
    expect(r.findings.find((x) => x.id === "X01")?.severity).toBe("medium");
  });
});
