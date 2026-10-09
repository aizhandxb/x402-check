import { expect, test } from "vitest";
import { checkJunkPayment } from "../src/checks/junk.js";
import { makeCtx } from "./ctx.js";
import { plain, v2Response } from "./fixtures.js";

test("X04 is critical when junk payment gets 2xx", async () => {
  expect(checkJunkPayment(await makeCtx(v2Response(), { junk: plain(200, {}, "paid content") }))).toMatchObject([{ id: "X04", severity: "critical" }]);
});
test("X04 passes on 402 (reference server) and 400 (spec)", async () => {
  for (const s of [402, 400]) {
    expect(checkJunkPayment(await makeCtx(v2Response(), { junk: plain(s) }))[0]?.title).toMatch(/^OK:/);
  }
});
test("X04 is info on an unexpected status", async () => {
  expect(checkJunkPayment(await makeCtx(v2Response(), { junk: plain(500) }))).toMatchObject([{ severity: "info", title: expect.not.stringMatching(/^OK:/) }]);
});
test("X04 reports nothing without a junk probe", async () => {
  expect(checkJunkPayment(await makeCtx(plain(200)))).toEqual([]);
});
