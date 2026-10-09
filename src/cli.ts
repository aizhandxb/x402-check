import { parseArgs } from "node:util";
import { checkEndpoint } from "./check-endpoint.js";
import { exitCodeFor, formatReport } from "./format.js";
import { CheckError, VERSION, type Fetcher } from "./types.js";

export const USAGE = `Usage: x402-check <url> [options]

Passive checks for an x402 payment endpoint. Never sends a real payment.

Options:
  --method GET|POST   HTTP method for the unpaid request (default GET)
  --json              Print the report as JSON
  --timeout <ms>      Total time budget in milliseconds (default 10000)
  -h, --help          Show this help
  --version           Show the version

Exit codes: 0 no high or critical findings, 1 high or critical findings, 2 usage or network error.`;

export interface CliIO {
  out: (s: string) => void;
  err: (s: string) => void;
  fetch: Fetcher;
}

export async function main(argv: string[], io: CliIO): Promise<number> {
  let parsed: ReturnType<typeof parseArgs<{ args: string[]; allowPositionals: true; options: {
    method: { type: "string"; default: string }; json: { type: "boolean"; default: false };
    timeout: { type: "string"; default: string }; help: { type: "boolean"; short: "h"; default: false };
    version: { type: "boolean"; default: false } } }>>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        method: { type: "string", default: "GET" },
        json: { type: "boolean", default: false },
        timeout: { type: "string", default: "10000" },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", default: false },
      },
    });
  } catch (e) {
    io.err(`${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) { io.out(USAGE); return 0; }
  if (values.version) { io.out(VERSION); return 0; }
  if (positionals.length !== 1) { io.err(USAGE); return 2; }
  const method = values.method.toUpperCase();
  if (method !== "GET" && method !== "POST") { io.err("--method must be GET or POST"); return 2; }
  const timeoutMs = Number(values.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) { io.err("--timeout must be a positive integer (milliseconds)"); return 2; }
  try {
    const report = await checkEndpoint(positionals[0] as string, { fetch: io.fetch, method, timeoutMs });
    io.out(values.json ? JSON.stringify(report, null, 2) : formatReport(report));
    return exitCodeFor(report);
  } catch (e) {
    if (e instanceof CheckError) { io.err(`error: ${e.message}`); return 2; }
    throw e;
  }
}
