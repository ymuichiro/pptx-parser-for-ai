---
layout: page
title: Security
permalink: /security/
---

## Security posture

- Fail-closed parser validation
- Path traversal protection for local assets
- Remote image loading disabled by default
- CI security tests and dependency audits

## Automation

- CodeQL analysis (`.github/workflows/security.yml`)
- npm audit gate (`high` and above)
- Dependabot updates (`.github/dependabot.yml`)

## Reporting vulnerabilities

See `SECURITY.md` for coordinated disclosure details.
