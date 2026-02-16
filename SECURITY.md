# Security Policy

## Supported versions

Security updates are provided for the latest release on `main`.

## Reporting a vulnerability

Please do not open public issues for suspected vulnerabilities.

- Contact: security@ymuichiro.dev
- Include: impact, reproduction steps, affected versions, and optional PoC
- Response target: within 3 business days

## Security controls in this repository

- CodeQL static analysis
- Dependency audit (`npm audit --omit=dev --audit-level=high`)
- Dependabot for dependency updates
- CI security tests for parser/path handling behavior

## Coordinated disclosure

After validation and fix rollout, advisories and remediation details are published transparently.
