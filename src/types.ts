export const VERSION = "0.1.0";
export const USER_AGENT = `x402-check/${VERSION} (+https://ledgers.ae/tools/x402-checker/)`;
export const DOCS_URL = "https://ledgers.ae/security/";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export const SEVERITY_ORDER: readonly Severity[] = ["critical", "high", "medium", "low", "info"];

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  evidence: string;
  fix: string;
  docs: string;
}

export interface CheckReport {
  url: string;
  checkedAt: string;
  specVersion: 1 | 2 | null;
  findings: Finding[];
  requestsMade: number;
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface CheckOptions {
  fetch: Fetcher;
  method?: "GET" | "POST";
  timeoutMs?: number;
  maxBodyBytes?: number;
  now?: () => Date;
}

export interface Snapshot {
  status: number;
  headers: Headers;
  bodyText: string;
}

export interface Parsed402 {
  version: 1 | 2 | null;
  requirements: unknown;
  decodeError?: string;
}

export interface ProbeContext {
  url: URL;
  first: Snapshot;
  parsed: Parsed402;
  junk?: Snapshot;
  redirect?: { from: string; to: string; crossHost: boolean; downgrade: boolean };
}

export type CheckErrorCode = "invalid_url" | "network" | "timeout" | "blocked";

export class CheckError extends Error {
  constructor(message: string, readonly code: CheckErrorCode) {
    super(message);
    this.name = "CheckError";
  }
}
