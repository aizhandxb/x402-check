import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const checks = readFileSync(new URL("../docs/checks.md", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("every check ID is documented", () => {
  for (const id of ["X01", "X02", "X03", "X04", "X05", "X06", "X07", "X08"]) expect(checks).toContain(`## ${id}`);
});
test("no em or en dashes in docs", () => {
  expect(/[\u2013\u2014]/.test(checks + readme)).toBe(false);
});
test("README states what it does not check and links the audit and guide", () => {
  expect(readme).toMatch(/What it does not check/);
  expect(readme).toContain("https://ledgers.ae/security/");
  expect(readme).toContain("https://ledgers.ae/services/agentic-payment-security-audit/");
});
