import { expect, test } from "vitest";
import { checkDiscovery } from "../src/checks/discovery.js";
import { makeCtx } from "./ctx.js";
import { clone, V2_REQUIRED, v1Response, v2Response } from "./fixtures.js";

test("bazaar extension present", async () => {
  const pr = { ...clone(V2_REQUIRED), extensions: { bazaar: { info: { input: { type: "http", method: "GET" } }, schema: {} } } };
  expect(checkDiscovery(await makeCtx(v2Response(pr)))[0]?.title).toMatch(/^OK:/);
});
test("bazaar extension absent is info", async () => {
  expect(checkDiscovery(await makeCtx(v2Response()))).toMatchObject([{ id: "X08", severity: "info", title: expect.stringMatching(/No discovery/) }]);
});
test("v1 is not checked", async () => {
  expect(checkDiscovery(await makeCtx(v1Response()))).toEqual([]);
});
