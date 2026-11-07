# Security Policy

## Supported versions

This project is developed on the `main` branch. Security fixes land on `main`
and are deployed from there; no long-lived release branches are maintained.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately using either of these channels:

1. GitHub's private vulnerability reporting:
   `Security` tab → `Advisories` → `Report a vulnerability`
   (enable it under *Settings → Code security* if it is not yet on), or
2. Email **mmarthaksimmons@gmail.com** with the subject line `SECURITY: domuzz`.

Please include:

- a description of the issue and the affected route/file,
- steps to reproduce (a request/response pair or proof-of-concept is ideal),
- the potential impact, and
- any suggested remediation.

You can expect an acknowledgement within **3 business days** and a status update
within **10 business days**. Please give us a reasonable window to ship a fix
before any public disclosure. We are happy to credit you in the fix.

## Secrets

This project reads every credential from the environment (see `.env.example`).
No API keys or database URLs are committed. If you fork or self-host:

- keep `.env*` files out of version control (they are git-ignored),
- use separate credentials per environment,
- rotate any key that you believe has leaked.

If you find a credential committed anywhere in this repository's history,
report it as a vulnerability rather than opening an issue.
