import { describe, expect, test } from "vitest";
import { checkRequirements } from "../src/checks/requirements.js";
import { makeCtx } from "./ctx.js";
import { clone, plain, V1_BODY, V2_REQUIRED, v1Response, v2Response } from "./fixtures.js";

const run = async (res: Response, url?: string) => checkRequirements(await makeCtx(res, { url }));
const titles = (f: { title: string }[]) => f.map((x) => x.title).join(" | ");

describe("X03 v2", () => {
  test("spec example passes", async () => {
    expect(await run(v2Response())).toMatchObject([{ id: "X03", severity: "info", title: expect.stringMatching(/^OK:/) }]);
  });
  test("undecodable header is high", async () => {
    const res = new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": "###" } });
    expect(await run(res)).toMatchObject([{ severity: "high", title: expect.stringMatching(/cannot be decoded/) }]);
  });
  test("empty accepts is high", async () => {
    const pr = clone(V2_REQUIRED); pr.accepts = [];
    expect(await run(v2Response(pr))).toMatchObject([{ severity: "high", title: expect.stringMatching(/No payment options/) }]);
  });
  test("v1 network name in v2 is high", async () => {
    const pr = clone(V2_REQUIRED); pr.accepts[0]!.network = "base-sepolia";
    expect(titles(await run(v2Response(pr)))).toMatch(/CAIP-2/);
  });
  test("payTo that does not match the namespace is high", async () => {
    const pr = clone(V2_REQUIRED); pr.accepts[0]!.payTo = "not-an-address";
    const f = await run(v2Response(pr));
    expect(f.some((x) => x.severity === "high" && /payTo/.test(x.title))).toBe(true);
  });
  test("zero or non-integer amount is high", async () => {
    for (const amount of ["0", "1.5", ""]) {
      const pr = clone(V2_REQUIRED); pr.accepts[0]!.amount = amount;
      expect(titles(await run(v2Response(pr)))).toMatch(/amount/);
    }
  });
  test("unknown scheme is medium, auth-capture is known", async () => {
    const pr = clone(V2_REQUIRED); pr.accepts[0]!.scheme = "mystery";
    expect((await run(v2Response(pr))).find((x) => /scheme/.test(x.title))?.severity).toBe("medium");
    const pr2 = clone(V2_REQUIRED); pr2.accepts[0]!.scheme = "auth-capture";
    expect((await run(v2Response(pr2)))[0]?.title).toMatch(/^OK:/);
  });
  test("resource.url mismatch is medium", async () => {
    const f = await run(v2Response(), "https://api.example.com/other");
    expect(f.find((x) => /resource\.url/.test(x.title))?.severity).toBe("medium");
  });
  test("missing resource.url is high", async () => {
    const pr = clone(V2_REQUIRED) as Record<string, unknown>; delete pr.resource;
    expect((await run(v2Response(pr))).find((x) => /resource\.url/.test(x.title))?.severity).toBe("high");
  });
});

describe("X03 v1", () => {
  test("spec example passes", async () => {
    expect((await run(v1Response()))[0]?.title).toMatch(/^OK:/);
  });
  test("missing maxAmountRequired is high", async () => {
    const b = clone(V1_BODY) as { accepts: Record<string, unknown>[] }; delete b.accepts[0]!.maxAmountRequired;
    expect(titles(await run(v1Response(b)))).toMatch(/amount/);
  });
});

test("402 without any requirements is high", async () => {
  expect(await run(plain(402, {}, "<html>Pay here</html>"))).toMatchObject([{ severity: "high", title: expect.stringMatching(/no x402 payment requirements/) }]);
});

test("not a 402: nothing to report", async () => {
  expect(await run(plain(200))).toEqual([]);
});
