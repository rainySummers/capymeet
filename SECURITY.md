# Security Policy

## Reporting A Vulnerability

Please do not open public issues for suspected vulnerabilities or leaked secrets.

Use GitHub private vulnerability reporting when it is enabled for the repository, or contact the repository maintainers through a private channel.

## Secret Handling

Do not commit real values for `JWT_SECRET`, email API keys, Cloudflare API tokens, D1 database IDs from private environments, `wrangler.toml`, `.dev.vars`, `.env*`, or local Wrangler state.
