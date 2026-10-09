## ADDED Requirements

### Requirement: Safe hosted checks
The Worker SHALL accept only `https:` URLs on the default port, SHALL reject hosts that are or resolve to loopback, private, link-local, CGNAT, benchmark, multicast or IPv4-mapped private addresses, and SHALL not follow redirects itself.

#### Scenario: Private address
- **WHEN** a check is requested for a hostname that resolves to 10.0.0.5
- **THEN** the Worker responds 400 with error `blocked` and makes no request to that host

### Requirement: Abuse controls
The Worker SHALL require a valid Turnstile token issued for `ledgers.ae`, SHALL rate-limit each client IP to 10 checks per minute, and SHALL only answer the `https://ledgers.ae` origin.

#### Scenario: Wrong origin
- **WHEN** a request arrives with a different `Origin` header or no `Origin`
- **THEN** the Worker responds 403 without running a check

### Requirement: Privacy
The Worker SHALL NOT store checked URLs or reports. Logs SHALL contain only the hostname and the top severity.

#### Scenario: Logging
- **WHEN** a check completes
- **THEN** exactly one log line with `event`, `host` and `top` fields is written
