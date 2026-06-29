# Contributing to CapyMeet

Thanks for helping improve CapyMeet.

## Development Setup

```bash
npm install
cp wrangler.example.toml wrangler.toml
npm test
npm run build
```

Use `wrangler.toml` for local Cloudflare and D1 configuration. Do not commit real Cloudflare IDs, API tokens, `.env*`, `.dev.vars`, or local Wrangler state.

## Before Opening A Pull Request

- Keep changes focused on one fix or feature.
- Add or update tests when behavior changes.
- Update README or docs when user-facing behavior, deployment steps, or configuration changes.
- Run `npm test` and `npm run build`.
- Do not include generated `dist/`, `node_modules/`, `.wrangler/`, or local environment files.

## Security

Do not open public issues for suspected vulnerabilities or leaked secrets. Follow [SECURITY.md](SECURITY.md).
