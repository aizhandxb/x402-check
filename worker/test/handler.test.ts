import { afterEach, describe, expect, test, vi } from "vitest";
import { createHandler, type Env } from "../src/index.js";
import type { Fetcher } from "../../src/types.js";
import { encodeBase64Json } from "../../src/wire.js";
import { V2_REQUIRED } from "../../test/fixtures.js";

const ORIGIN = "https://ledgers.ae";
function env(limitOk = true): Env {
  return {
    ALLOWED_ORIGIN: ORIGIN,
    TURNSTILE_HOSTNAME: "ledgers.ae",
    TURNSTILE_SECRET: "secret",
    CHECK_LIMITER: { limit: async () => ({ success: limitOk }) },
  };
}

// Routes by URL: Turnstile, DoH, and the target endpoint.
function net(opts: { turnstile?: { success: boolean; hostname?: string }; ip?: string } = {}): Fetcher & { targets: string[] } {
  const targets: string[] = [];
  const f = (async (url: string) => {
    if (url.startsWith("https://challenges.cloudflare.com/")) {
      return Response.json(opts.turnstile ?? { success: true, hostname: "ledgers.ae" });
    }
    if (url.startsWith("https://cloudflare-dns.com/")) {
      const type = new URL(url).searchParams.get("type");
      return Response.json({ Answer: type === "A" ? [{ type: 1, data: opts.ip ?? "93.184.216.34" }] : [] });
    }
    targets.push(url);
    return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encodeBase64Json(V2_REQUIRED), "cache-control": "no-store" } });
  }) as Fetcher & { targets: string[] };
  f.targets = targets;
  return f;
}

const req = (body: unknown, origin: string | null = ORIGIN, method = "POST", path = "/check") =>
  new Request(`https://x402-check.example.workers.dev${path}`, {
    method,
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}), "cf-connecting-ip": "203.0.113.9" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
const good = { url: "https://api.example.com/premium-data", turnstileToken: "tok" };

afterEach(() => vi.restoreAllMocks());

describe("worker", () => {
  test("happy path returns a report with CORS for ledgers.ae and logs one line", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const f = net();
    const res = await createHandler(f)(req(good), env());
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const report = (await res.json()) as { specVersion: number; requestsMade: number };
    expect(report.specVersion).toBe(2);
    expect(f.targets.length).toBe(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual({ event: "check", host: "api.example.com", top: "info" });
  });

  test.each([[null], ["https://evil.example"]])("origin %s gets 403 and no check runs", async (origin) => {
    const f = net();
    const res = await createHandler(f)(req(good, origin), env());
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(f.targets.length).toBe(0);
  });

  test("preflight from the allowed origin", async () => {
    const res = await createHandler(net())(req(undefined, ORIGIN, "OPTIONS"), env());
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toMatch(/POST/);
  });

  test("rate limited gets 429", async () => {
    expect((await createHandler(net())(req(good), env(false))).status).toBe(429);
  });

  test("failed Turnstile gets 403 and no check runs", async () => {
    const f = net({ turnstile: { success: false } });
    const res = await createHandler(f)(req(good), env());
    expect(res.status).toBe(403);
    expect(f.targets.length).toBe(0);
  });

  test("Turnstile token from another hostname is rejected", async () => {
    const res = await createHandler(net({ turnstile: { success: true, hostname: "other.example" } }))(req(good), env());
    expect(res.status).toBe(403);
  });

  test("private target gets 400 blocked and is never fetched", async () => {
    const f = net({ ip: "10.0.0.5" });
    const res = await createHandler(f)(req(good), env());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "blocked" });
    expect(f.targets.length).toBe(0);
  });

  test("bad JSON and bad url are 400", async () => {
    const bad = new Request("https://w.example/check", { method: "POST", headers: { origin: ORIGIN }, body: "{" });
    expect((await createHandler(net())(bad, env())).status).toBe(400);
    expect((await createHandler(net())(req({ url: 42, turnstileToken: "t" }), env())).status).toBe(400);
  });

  test("health and unknown routes", async () => {
    expect((await createHandler(net())(req(undefined, null, "GET", "/health"), env())).status).toBe(200);
    expect((await createHandler(net())(req(undefined, null, "GET", "/nope"), env())).status).toBe(404);
  });
});
