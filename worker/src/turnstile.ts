import type { Fetcher } from "../../src/types.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Returns false (never throws) on an empty token, a failed verification, a
// hostname mismatch, or a network error. Callers reject on anything but true.
export async function siteVerify(token: string, ip: string, secret: string, fetchImpl: Fetcher, expectedHostname: string): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json()) as { success?: boolean; hostname?: string };
    return data.success === true && data.hostname === expectedHostname;
  } catch {
    return false;
  }
}
