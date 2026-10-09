# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately. On this repository, open the **Security** tab and choose **Report a vulnerability** (GitHub private vulnerability reporting). Do not open a public issue for security problems.

Include what you found, how to reproduce it, and the impact you expect. Reports are reviewed promptly and handled confidentially.

## Scope

In scope:

- the library (`src/`),
- the CLI (`x402-check`),
- the hosted Worker (`worker/`), including its SSRF guard, Turnstile verification and rate limiting.

## Design note

x402-check is passive by design: it never sends a real payment and sends at most three requests per check (an unpaid request, at most one same-origin redirect, and one request with a deliberately malformed payment header). Findings about the checked endpoints belong to the owners of those endpoints, not to this project.
