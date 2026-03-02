# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in 1300.io, please report it responsibly. Do not open a public GitHub issue for security vulnerabilities.

**Contact:** security@stoicera.com

Alternatively, you can email office@stoicera.com with the subject line "Security Vulnerability Report".

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

## Response Timeline

- **Acknowledgment**: Within 48 hours of receiving your report
- **Initial assessment**: Within 5 business days
- **Resolution target**: Within 30 days for critical issues, 90 days for lower severity

## Scope

The following are in scope:
- Authentication and authorization bypasses
- Injection vulnerabilities (SQL, XSS, command injection)
- Sensitive data exposure
- Server-side request forgery (SSRF)
- Insecure file upload handling
- PDF generation security issues

The following are out of scope:
- Denial of service attacks
- Social engineering
- Issues in third-party dependencies (report these to the respective maintainers)
- Issues that require physical access to the server

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | Yes |
| Older releases | Best effort |

## Disclosure Policy

We follow responsible disclosure. Once a fix is released, we will:
1. Credit the reporter (unless they prefer anonymity)
2. Publish a security advisory on GitHub
3. Update the changelog

We ask that you give us reasonable time to address the issue before public disclosure.
