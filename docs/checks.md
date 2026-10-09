# Checks

Every finding has an ID (X01 to X08), a severity (critical, high, medium, low, info) and a fix. This page explains what each check looks at and how to resolve it. The text matches what the tool prints.

## X01 - Unpaid requests get HTTP 402

**What it looks at:** the status code of a plain request with no payment header.

**Fails when:** the response is 2xx (the content is served without payment), or any other status that is not 402, such as 401, 404 or 405.

**Severity:** critical for 2xx. Medium for any other non-402 status.

**How to fix:** gate the route with x402 middleware so unpaid requests get HTTP 402 with a `PAYMENT-REQUIRED` header. If the route needs a body or another method, re-run with `--method POST`.

## X02 - x402 v2 vs v1

**What it looks at:** whether the 402 carries a `PAYMENT-REQUIRED` header (v2) or only a JSON body with `x402Version: 1` (v1). Skipped when X01 did not return 402.

**Fails when:** the endpoint speaks v1.

**Severity:** medium.

**How to fix:** send requirements as base64 JSON in a `PAYMENT-REQUIRED` header and accept `PAYMENT-SIGNATURE`. Serve both during the migration if you have v1 clients.

## X03 - Payment requirements are complete and valid

**What it looks at:** the decoded payment requirements. For v2: `resource.url`, and for every `accepts` entry the scheme, network (CAIP-2 identifier), `amount`, `asset`, `payTo` (checked against the address format of the network) and `maxTimeoutSeconds`. For v1 the same, with `maxAmountRequired` in place of `amount`. Skipped when X01 did not return 402.

**Fails when:** the header cannot be decoded; there are no requirements at all; `accepts` is empty; a required field is missing; the network is not CAIP-2 (v2); the amount is not a positive integer string; `payTo` does not match the network's address format; `resource.url` points somewhere other than the URL you checked; the scheme is unrecognized; or `maxTimeoutSeconds` is not a positive integer.

**Severity:** high for undecodable or missing requirements, empty `accepts`, missing fields, bad network, bad amount and a mismatched `payTo`. Medium for an unrecognized scheme, a `resource.url` mismatch and a bad `maxTimeoutSeconds`.

**How to fix:** encode the full `PaymentRequired` object as base64 JSON, list at least one `accepts` entry, and set every field. Prices go in the asset's smallest unit as a string of digits. Double-check `payTo`: a wrong address means payments go nowhere you control.

## X04 - A junk payment header is rejected

**What it looks at:** after a 402, the checker repeats the request with a `PAYMENT-SIGNATURE` header (v1: `X-PAYMENT`) set to base64 text that is not a payment.

**Fails when:** the response is 2xx. That means the server serves content when any payment header is present, without verifying it. Any status other than 2xx, 400 or 402 is reported as an informational finding.

**Severity:** critical. 400 (what the spec asks for) and 402 (what the reference server returns) both pass. Other statuses are info.

**How to fix:** decode the payload and verify it with your facilitator's `/verify` endpoint before serving. Reject anything that fails. Make sure payment parsing errors are handled and do not crash the route.

## X05 - Paid responses can't be cached by a CDN

**What it looks at:** `Cache-Control`, `Age`, `CF-Cache-Status` and `X-Cache` on the 402 response.

**Fails when:** a cache hit is reported and `Cache-Control` does not forbid shared caching (high); a cache hit is reported even though `no-store` or `private` is set (medium); or there is no `no-store` or `private` directive at all (low).

**Severity:** high, medium or low as above.

**How to fix:** send `Cache-Control: private, no-store` on the 402 and on paid responses, add a CDN bypass rule for the path, then confirm paid responses are never served from cache.

## X06 - HTTPS and no cross-host redirect

**What it looks at:** the URL scheme and any redirect the endpoint answered with.

**Fails when:** the endpoint is served over plain HTTP (localhost is exempt), or it redirects to a different host.

**Severity:** high.

**How to fix:** serve the endpoint over HTTPS, and serve the 402 from the requested host. Clients may resend payment headers to a redirect target.

## X07 - CORS exposes payment headers

**What it looks at:** `Access-Control-Allow-Origin` and `Access-Control-Expose-Headers` on the 402. Only runs for v2 endpoints. This check is advisory: the x402 spec does not cover CORS.

**Fails when:** CORS is enabled but `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE` are not both exposed. With no CORS headers at all the tool reports an informational note, not a failure.

**Severity:** low for missing exposed headers. Info when CORS is not set.

**How to fix:** add `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE` to `Access-Control-Expose-Headers` so browser agents can read them. Not needed for server-side agents.

## X08 - Discovery (Bazaar) metadata

**What it looks at:** whether the v2 requirements include an `extensions.bazaar` object.

**Fails when:** it is absent. This is optional, so it is informational only.

**Severity:** info.

**How to fix:** add the bazaar extension so agents can discover your endpoint and its input and output.
