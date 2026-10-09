import type { CheckReport } from "./types.js";

const AUDIT_URL = "https://ledgers.ae/services/agentic-payment-security-audit/";

// C0 controls (including \n and \t), DEL and C1 controls. Endpoint-controlled text
// must never reach the terminal raw: escape sequences could rewrite or spoof output.
// Also covers bidi overrides/isolates, zero-width characters, line/paragraph separators and the BOM.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g;

export function sanitize(s: string): string {
  return s.replace(CONTROL_CHARS, (c) => {
    const code = c.charCodeAt(0);
    return code <= 0xff ? `\\x${code.toString(16).padStart(2, "0")}` : `\\u{${code.toString(16)}}`;
  });
}

export function exitCodeFor(report: CheckReport): 0 | 1 {
  return report.findings.some((f) => f.severity === "critical" || f.severity === "high") ? 1 : 0;
}

export function formatReport(report: CheckReport): string {
  const lines = [
    `x402-check ${sanitize(report.url)}`,
    `spec version: ${report.specVersion ?? "not detected"} | requests: ${report.requestsMade}`,
    "",
  ];
  for (const f of report.findings) {
    lines.push(`[${sanitize(f.severity.toUpperCase())}] ${sanitize(f.id)} ${sanitize(f.title)}`);
    lines.push(`  evidence: ${sanitize(f.evidence)}`);
    if (!f.title.startsWith("OK:")) lines.push(`  fix: ${sanitize(f.fix)}`);
  }
  const counts = (["critical", "high", "medium", "low"] as const)
    .map((s) => `${report.findings.filter((f) => f.severity === s).length} ${s}`)
    .join(", ");
  lines.push("", `Summary: ${counts}`);
  lines.push(`Passive checks only. For replay and settlement testing: ${AUDIT_URL}`);
  return lines.join("\n");
}
