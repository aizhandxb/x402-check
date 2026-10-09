import { info, ok } from "../findings.js";
import type { Finding, ProbeContext } from "../types.js";

export function checkDiscovery(ctx: ProbeContext): Finding[] {
  const pr = ctx.parsed.requirements;
  if (ctx.parsed.version !== 2 || typeof pr !== "object" || pr === null) return [];
  const ext = (pr as { extensions?: unknown }).extensions;
  const bazaar = typeof ext === "object" && ext !== null ? (ext as { bazaar?: unknown }).bazaar : undefined;
  if (typeof bazaar === "object" && bazaar !== null) return [ok("X08", "Discovery (Bazaar) metadata present", "extensions.bazaar found")];
  return [info("X08", "No discovery (Bazaar) metadata", "extensions.bazaar not present",
    "Optional: add the bazaar extension so agents can discover your endpoint and its input and output.")];
}
