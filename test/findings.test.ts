import { expect, test } from "vitest";
import { finding, ok, sortFindings } from "../src/findings.js";
import { DOCS_URL } from "../src/types.js";

test("ok findings are info with an OK: title and the docs link", () => {
  const f = ok("X01", "Unpaid request returns 402", "HTTP 402");
  expect(f).toMatchObject({ id: "X01", severity: "info", title: "OK: Unpaid request returns 402", docs: DOCS_URL });
});

test("sorts by severity, stable within a severity", () => {
  const a = finding("X05", "low", "a", "", "");
  const b = finding("X01", "critical", "b", "", "");
  const c = finding("X03", "low", "c", "", "");
  expect(sortFindings([a, b, c]).map((f) => f.title)).toEqual(["b", "a", "c"]);
});
