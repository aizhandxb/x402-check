import { describe, expect, test } from "vitest";
import { assertPublicUrl, dohResolver, guardedFetch, isBlockedIp } from "../src/guard.js";
import type { Fetcher } from "../../src/types.js";

describe("isBlockedIp", () => {
  test.each([
    "0.0.0.0", "10.0.0.5", "127.0.0.1", "100.64.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "fd00::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  test.each(["1.1.1.1", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false));
});

const resolveTo = (ips: string[]) => async () => ips;

describe("assertPublicUrl", () => {
  test("accepts a public https URL", async () => {
    await expect(assertPublicUrl("https://api.example.com/x", resolveTo(["93.184.216.34"]))).resolves.toBeInstanceOf(URL);
  });
  test.each([
    ["http://api.example.com/x", "invalid_url"],
    ["https://user:pw@api.example.com/x", "invalid_url"],
    ["https://api.example.com:8443/x", "blocked"],
    ["https://localhost/x", "blocked"],
    ["https://db.internal/x", "blocked"],
    ["https://127.0.0.1/x", "blocked"],
    ["https://[::1]/x", "blocked"],
    ["https://[fd00::1]/x", "blocked"],
  ])("rejects %s with %s", async (url, code) => {
    await expect(assertPublicUrl(url, resolveTo(["93.184.216.34"]))).rejects.toMatchObject({ code });
  });
  test("rejects a hostname that resolves to a private address", async () => {
    await expect(assertPublicUrl("https://sneaky.example.com/", resolveTo(["93.184.216.34", "10.0.0.5"]))).rejects.toMatchObject({ code: "blocked" });
  });
  test("rejects a hostname that does not resolve", async () => {
    await expect(assertPublicUrl("https://nothing.example.com/", resolveTo([]))).rejects.toMatchObject({ code: "network" });
  });
});

describe("guardedFetch", () => {
  test("never calls the inner fetch for a blocked URL", async () => {
    let called = false;
    const inner: Fetcher = async () => { called = true; return new Response("x"); };
    const f = guardedFetch(inner, resolveTo(["10.0.0.1"]));
    await expect(f("https://internal.example.com/")).rejects.toMatchObject({ code: "blocked" });
    expect(called).toBe(false);
  });
  test("forces redirect manual on every request", async () => {
    let seen: RequestInit | undefined;
    const inner: Fetcher = async (_u, init) => { seen = init; return new Response("x"); };
    await guardedFetch(inner, resolveTo(["1.1.1.1"]))("https://ok.example.com/", { redirect: "follow" });
    expect(seen?.redirect).toBe("manual");
  });
});

describe("dohResolver", () => {
  test("collects A and AAAA answers and ignores CNAME records", async () => {
    const fetchImpl: Fetcher = async (url) => {
      const type = new URL(url).searchParams.get("type");
      const answers = type === "A"
        ? [{ type: 5, data: "alias.example.com." }, { type: 1, data: "93.184.216.34" }]
        : [{ type: 28, data: "2606:2800:220:1::1" }];
      return Response.json({ Answer: answers });
    };
    expect(await dohResolver(fetchImpl)("example.com")).toEqual(["93.184.216.34", "2606:2800:220:1::1"]);
  });
  test("DNS failure is a network error", async () => {
    const fetchImpl: Fetcher = async () => new Response("err", { status: 500 });
    await expect(dohResolver(fetchImpl)("example.com")).rejects.toMatchObject({ code: "network" });
  });
});

describe("isBlockedIp IPv6 bypass regressions", () => {
  test.each([
    "::ffff:7f00:1", "::ffff:a00:1", "::7f00:1", "::ffff:0:a00:1", "0:0:0:0:0:0:0:1", "0::1", "0:0:0:0:0:0:0:0",
    "::ffff:192.168.1.1", "fe80::1%eth0",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  test.each(["::ffff:808:808", "2001:4860:4860::8888"])("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe("isBlockedIp transition prefixes and documentation ranges", () => {
  test.each([
    "64:ff9b::a00:1", "64:ff9b::7f00:1", "2002:a00:1::", "2002:7f00:1::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "fec0::1",
    "192.0.0.1", "192.0.2.5", "198.51.100.7", "203.0.113.9",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  test.each(["64:ff9b::808:808", "2002:808:808::1"])("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe("dohResolver DNS status", () => {
  test("a SERVFAIL on the A query is a network error even if AAAA answers", async () => {
    const fetchImpl: Fetcher = async (url) =>
      new URL(url).searchParams.get("type") === "A"
        ? Response.json({ Status: 2 })
        : Response.json({ Status: 0, Answer: [{ type: 28, data: "2606:2800:220:1::1" }] });
    await expect(dohResolver(fetchImpl)("example.com")).rejects.toMatchObject({ code: "network" });
  });
  test("NXDOMAIN yields no addresses", async () => {
    const fetchImpl: Fetcher = async () => Response.json({ Status: 3 });
    expect(await dohResolver(fetchImpl)("nope.example.com")).toEqual([]);
  });
});

describe("assertPublicUrl bypass regressions", () => {
  test.each([
    "https://localhost../",
    "https://foo.internal../",
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:a00:1]/",
    "https://[::127.0.0.1]/",
    "https://localhost./",
    "https://db.internal./",
    "https://0x7f.1/",
    "https://2130706433/",
    "https://127.1/",
  ])("rejects %s with blocked", async (url) => {
    await expect(assertPublicUrl(url, resolveTo(["93.184.216.34"]))).rejects.toMatchObject({ code: "blocked" });
  });
});
