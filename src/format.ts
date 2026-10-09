import type { CheckReport } from "./types.js";

const AUDIT_URL = "https://ledgers.ae/services/agentic-payment-security-audit/";

export function exitCodeFor(report: CheckReport): 0 | 1 {
  return report.findings.some((f) => f.severity === "critical" || f.severity === "high") ? 1 : 0;
}

export function formatReport(report: CheckReport): string {
  const lines = [
    `x402-check ${report.url}`,
    `spec version: ${report.specVersion ?? "not detected"} | requests: ${report.requestsMade}`,
    "",
  ];
  for (const f of report.findings) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.id} ${f.title}`);
    lines.push(`  evidence: ${f.evidence}`);
    if (!f.title.startsWith("OK:")) lines.push(`  fix: ${f.fix}`);
  }
  const counts = (["critical", "high", "medium", "low"] as const)
    .map((s) => `${report.findings.filter((f) => f.severity === s).length} ${s}`)
    .join(", ");
  lines.push("", `Summary: ${counts}`);
  lines.push(`Passive checks only. For replay and settlement testing: ${AUDIT_URL}`);
  return lines.join("\n");
}
