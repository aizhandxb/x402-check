import { expect, test } from "vitest";
import { checkTransport } from "../src/checks/transport.js";
import { makeCtx } from "./ctx.js";
import { v2Response } from "./fixtures.js";

test("X06 passes on https without redirect", async () => {
  expect(checkTransport(await makeCtx(v2Response()))).toMatchObject([{ id: "X06", severity: "info" }]);
});
test("X06 is high on plain http to a public host", async () => {
  const f = checkTransport(await makeCtx(v2Response(), { url: "http://api.example.com/x" }));
  expect(f).toMatchObject([{ id: "X06", severity: "high", title: expect.stringMatching(/plain HTTP/) }]);
});
test("X06 allows http on localhost for local development", async () => {
  expect(checkTransport(await makeCtx(v2Response(), { url: "http://localhost:4021/weather" }))[0]?.severity).toBe("info");
});
test("X06 is high on a cross-host redirect", async () => {
  const redirect = { from: "https://a.example/x", to: "https://b.example/x", crossHost: true, downgrade: false };
  expect(checkTransport(await makeCtx(v2Response(), { redirect }))).toMatchObject([{ id: "X06", severity: "high", title: expect.stringMatching(/different host/) }]);
});
test("X06 is high on an https to http downgrade redirect", async () => {
  const redirect = { from: "https://a.example/x", to: "http://a.example/x", crossHost: false, downgrade: true };
  expect(checkTransport(await makeCtx(v2Response(), { redirect }))).toMatchObject([{ id: "X06", severity: "high", title: expect.stringMatching(/plain HTTP/) }]);
});
