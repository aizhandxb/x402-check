#!/usr/bin/env node
import { main } from "./cli.js";
import { sanitize } from "./format.js";

main(process.argv.slice(2), {
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
  fetch: (input, init) => fetch(input, init),
})
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    process.stderr.write(`error: ${sanitize(String(e))}\n`);
    process.exitCode = 2;
  });
