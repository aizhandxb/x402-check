import { checkEndpoint } from "../../src/check-endpoint.js";
import { CheckError, type Fetcher } from "../../src/types.js";
import { dohResolver, guardedFetch } from "./guard.js";
import { siteVerify } from "./turnstile.js";

export interface Env {
  ALLOWED_ORIGIN: string;
  TURNSTILE_HOSTNAME: string;
  TURNSTILE_SECRET: string;
  CHECK_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

export function createHandler(fetchImpl: Fetcher = (input, init) => fetch(input, init)) {
  return async function handle(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = origin !== "" && origin === env.ALLOWED_ORIGIN;
    const cors: Record<string, string> = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });

    const path = new URL(req.url).pathname;
    if (req.method === "OPTIONS") {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" },
      });
    }
    if (path === "/health" && req.method === "GET") return json(200, { ok: true });
    if (path !== "/check" || req.method !== "POST") return json(404, { error: "not_found" });
    if (!allowed) return json(403, { error: "origin_not_allowed" });

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.CHECK_LIMITER.limit({ key: ip });
    if (!success) return json(429, { error: "rate_limited" });

    let body: { url?: unknown; method?: unknown; turnstileToken?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return json(400, { error: "invalid_json" });
    if (typeof body.url !== "string" || body.url.length > 2048) return json(400, { error: "invalid_url" });
    const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
    if (!(await siteVerify(token, ip, env.TURNSTILE_SECRET, fetchImpl, env.TURNSTILE_HOSTNAME))) {
      return json(403, { error: "turnstile_failed" });
    }

    try {
      const report = await checkEndpoint(body.url, {
        fetch: guardedFetch(fetchImpl, dohResolver(fetchImpl)),
        method: body.method === "POST" ? "POST" : "GET",
        timeoutMs: 10_000,
        maxBodyBytes: 262_144,
      });
      console.log(JSON.stringify({ event: "check", host: new URL(report.url).hostname, top: report.findings[0]?.severity ?? "info" }));
      return json(200, report);
    } catch (e) {
      if (e instanceof CheckError) {
        const status = e.code === "blocked" || e.code === "invalid_url" ? 400 : 502;
        return json(status, { error: e.code, message: e.message });
      }
      throw e;
    }
  };
}

export default { fetch: (req: Request, env: Env) => createHandler()(req, env) };
