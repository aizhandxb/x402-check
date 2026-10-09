import { DOCS_URL, SEVERITY_ORDER, type Finding, type Severity } from "./types.js";

export function finding(id: string, severity: Severity, title: string, evidence: string, fix: string): Finding {
  return { id, severity, title, evidence, fix, docs: DOCS_URL };
}

export function ok(id: string, title: string, evidence: string): Finding {
  return finding(id, "info", `OK: ${title}`, evidence, "No action needed.");
}

export function info(id: string, title: string, evidence: string, fix: string): Finding {
  return finding(id, "info", title, evidence, fix);
}

export function sortFindings(findings: Finding[]): Finding[] {
  return findings
    .map((f, i) => ({ f, i }))
    .sort((x, y) => SEVERITY_ORDER.indexOf(x.f.severity) - SEVERITY_ORDER.indexOf(y.f.severity) || x.i - y.i)
    .map(({ f }) => f);
}
