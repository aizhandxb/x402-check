import { expect, test } from "vitest";
import { checkCache } from "../src/checks/cache.js";
import { makeCtx } from "./ctx.js";
import { v2Response } from "./fixtures.js";

const sev = async (headers: Record<string, string>) => checkCache(await makeCtx(v2Response(undefined, headers)))[0]?.severity;

test("cache hit without no-store is high", async () => {
  expect(await sev({ "cf-cache-status": "HIT" })).toBe("high");
  expect(await sev({ "x-cache": "Hit from cloudfront" })).toBe("high");
  expect(await sev({ age: "120" })).toBe("high");
});
test("cache hit despite no-store is medium", async () => {
  expect(await sev({ "cf-cache-status": "HIT", "cache-control": "private, no-store" })).toBe("medium");
});
test("no cache hit and no no-store is low", async () => {
  expect(await sev({})).toBe("low");
});
test("no-store or private with no hit passes", async () => {
  expect(await sev({ "cache-control": "no-store" })).toBe("info");
  expect(await sev({ "cache-control": "private, max-age=0" })).toBe("info");
});
test("cf-cache-status MISS and age 0 are not hits", async () => {
  expect(await sev({ "cf-cache-status": "MISS", age: "0", "cache-control": "no-store" })).toBe("info");
});
