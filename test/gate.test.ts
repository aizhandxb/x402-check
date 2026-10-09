import { expect, test } from "vitest";
import { checkPaymentGate, checkSpecVersion } from "../src/checks/gate.js";
import { makeCtx } from "./ctx.js";
import { plain, v1Response, v2Response } from "./fixtures.js";

test("X01 passes on 402", async () => {
  expect(checkPaymentGate(await makeCtx(v2Response()))).toMatchObject([{ id: "X01", severity: "info", title: expect.stringMatching(/^OK:/) }]);
});
test("X01 is critical when content is served without payment", async () => {
  expect(checkPaymentGate(await makeCtx(plain(200, {}, "secret")))).toMatchObject([{ id: "X01", severity: "critical" }]);
});
test("X01 is medium for other statuses", async () => {
  expect(checkPaymentGate(await makeCtx(plain(404)))).toMatchObject([{ id: "X01", severity: "medium" }]);
});
test("X02 passes on v2", async () => {
  expect(checkSpecVersion(await makeCtx(v2Response()))).toMatchObject([{ id: "X02", severity: "info" }]);
});
test("X02 is medium on v1", async () => {
  expect(checkSpecVersion(await makeCtx(v1Response()))).toMatchObject([{ id: "X02", severity: "medium" }]);
});
test("X02 reports nothing when there is no 402", async () => {
  expect(checkSpecVersion(await makeCtx(plain(200)))).toEqual([]);
});
