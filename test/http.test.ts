import { expect, test } from "vitest";
import { readCapped } from "../src/http.js";

test("reads small bodies fully", async () => {
  expect(await readCapped(new Response("hello"), 1024)).toBe("hello");
});

test("stops at the cap on an endless stream and cancels it", async () => {
  let cancelled = false;
  const chunk = new TextEncoder().encode("a".repeat(1000));
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  });
  const text = await readCapped(new Response(stream), 2500);
  expect(text.length).toBe(2500);
  expect(cancelled).toBe(true);
});

test("returns empty string for a null body", async () => {
  expect(await readCapped(new Response(null, { status: 204 }), 10)).toBe("");
});
