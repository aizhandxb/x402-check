import { expect, test } from "vitest";
import { VERSION } from "../src/types.js";

test("exposes a semver version", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
