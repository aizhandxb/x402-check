import { toSnapshot } from "../src/http.js";
import type { ProbeContext } from "../src/types.js";
import { parse402 } from "../src/wire.js";
import { TARGET } from "./fixtures.js";

export async function makeCtx(
  first: Response,
  opts: { url?: string; junk?: Response; redirect?: ProbeContext["redirect"] } = {},
): Promise<ProbeContext> {
  const snap = await toSnapshot(first, 262_144);
  return {
    url: new URL(opts.url ?? TARGET),
    first: snap,
    parsed: parse402(snap.headers, snap.bodyText),
    junk: opts.junk ? await toSnapshot(opts.junk, 262_144) : undefined,
    redirect: opts.redirect,
  };
}
