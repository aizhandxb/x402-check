## ADDED Requirements

### Requirement: Passive probing
The checker SHALL send at most 3 HTTP requests per check, SHALL never sign or send a real payment, and SHALL send `Accept: application/json` with the x402-check User-Agent.

#### Scenario: Request budget
- **WHEN** an endpoint redirects to the same host and then returns 402
- **THEN** the checker sends the original request, follows one redirect, sends one junk-payment request, and reports `requestsMade` of 3

### Requirement: Findings
Each finding SHALL carry an ID from X01 to X08, a severity (critical, high, medium, low, info), evidence, a fix and a docs link. Passing checks SHALL be reported as info findings whose title starts with "OK:".

#### Scenario: Ungated content
- **WHEN** an unpaid request returns HTTP 200
- **THEN** the report contains an X01 finding with severity critical

#### Scenario: Junk payment accepted
- **WHEN** the endpoint returns 402 and then 2xx for a request with a malformed payment header
- **THEN** the report contains an X04 finding with severity critical

### Requirement: Version detection
The checker SHALL report spec version 2 when a 402 response carries a base64 JSON `PAYMENT-REQUIRED` header, version 1 when the 402 body is JSON with `x402Version` 1, and null otherwise.

#### Scenario: v1 endpoint
- **WHEN** a 402 response has a JSON body with `x402Version: 1` and no `PAYMENT-REQUIRED` header
- **THEN** `specVersion` is 1 and an X02 finding with severity medium is reported

### Requirement: Bounded reads
The checker SHALL stop reading a response body after 256 KB and SHALL fail with a timeout error when the total time budget (default 10 seconds) is exhausted.

#### Scenario: Endless body
- **WHEN** the endpoint streams a body larger than the cap
- **THEN** at most 256 KB is read and the check still completes
