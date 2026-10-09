## ADDED Requirements

### Requirement: CLI contract
The CLI SHALL accept one URL and the options `--method GET|POST`, `--json`, `--timeout <ms>`, `--help` and `--version`. It SHALL exit 0 when there are no critical or high findings, 1 when there are, and 2 on usage or network errors.

#### Scenario: CI failure
- **WHEN** the checked endpoint serves content without payment
- **THEN** the CLI exits with code 1

#### Scenario: JSON output
- **WHEN** the user passes `--json`
- **THEN** stdout is a single JSON CheckReport
