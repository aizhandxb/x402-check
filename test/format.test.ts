import { expect, test } from "vitest";
import { formatReport } from "../src/format.js";
import type { CheckReport } from "../src/types.js";

const HOSTILE = "a\u001b[2J b\u001b]8;;http://evil\u0007 c\u009b31m d\re\u0000f";
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;

function hostileReport(): CheckReport {
  return {
    url: `https://api.example.com/${HOSTILE}`,
    checkedAt: "2026-10-09T00:00:00.000Z",
    specVersion: 2,
    requestsMade: 2,
    findings: [
      { id: "X01", severity: "high", title: `Title ${HOSTILE}`, evidence: `Evidence ${HOSTILE}`, fix: `Fix ${HOSTILE}`, docs: "https://ledgers.ae/security/" },
    ],
  };
}

test("formatReport emits no raw control characters from endpoint-controlled fields", () => {
  const text = formatReport(hostileReport());
  expect(text).not.toMatch(CONTROL);
});

test("formatReport keeps the visible text of hostile fields as escapes", () => {
  const text = formatReport(hostileReport());
  expect(text).toContain("\\x1b[2J");
  expect(text).toContain("\\x1b]8;;http://evil\\x07");
  expect(text).toContain("\\x9b31m");
  expect(text).toContain("\\x0d");
  expect(text).toContain("\\x00");
});

test("formatReport still prints one line per finding header", () => {
  const lines = formatReport(hostileReport()).split("\n");
  expect(lines.filter((l) => l.startsWith("[HIGH] X01 ")).length).toBe(1);
});

test("JSON output of the same report contains no raw ESC character", () => {
  expect(JSON.stringify(hostileReport(), null, 2)).not.toContain("\u001b");
});

test("formatReport escapes bidi, zero-width, separator and BOM characters", () => {
  const nasty = "a\u202eb\u200bc\u2028d\u2029e\ufeff\u2066f\u2069g";
  const report = hostileReport();
  report.findings[0]!.evidence = nasty;
  const text = formatReport(report);
  expect(text).not.toMatch(/[\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/);
  expect(text).toContain("\\u{202e}");
  expect(text).toContain("\\u{200b}");
});
