import { expect, test } from "vitest";
import { checkCors } from "../src/checks/cors.js";
import { makeCtx } from "./ctx.js";
import { v1Response, v2Response } from "./fixtures.js";

test("no CORS at all is info, not OK", async () => {
  expect(checkCors(await makeCtx(v2Response()))).toMatchObject([{ id: "X07", severity: "info", title: expect.not.stringMatching(/^OK:/) }]);
});
test("CORS without exposed payment headers is low", async () => {
  const res = v2Response(undefined, { "access-control-allow-origin": "*" });
  expect(checkCors(await makeCtx(res))).toMatchObject([{ severity: "low" }]);
});
test("CORS exposing both payment headers passes", async () => {
  const res = v2Response(undefined, { "access-control-allow-origin": "*", "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE" });
  expect(checkCors(await makeCtx(res))[0]?.title).toMatch(/^OK:/);
});
test("v1 endpoints are not checked for CORS headers", async () => {
  expect(checkCors(await makeCtx(v1Response(undefined, { "access-control-allow-origin": "*" })))).toEqual([]);
});
