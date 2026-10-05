# Security

## Threat model
Homi is an admin tool that runs on your LAN and optionally behind a reverse proxy. The main risks are (1) unauthenticated access, (2) using Homi as a proxy to reach internal services it should not (SSRF), and (3) leaking stored secrets.

## Authentication
- First run: `/setup` creates the only account; it is rejected (409) once a user exists. Set `HOMI_SETUP_TOKEN` if Homi is reachable before you finish setup.
- Passwords: argon2id. Sessions: 32 random bytes in an `HttpOnly; SameSite=Lax` cookie (`Secure` over HTTPS); only a SHA-256 of the token is stored. 30-day sliding expiry. Changing the password revokes other sessions.
- Login is rate-limited per IP and per username with exponential lockout.
- Mutating requests require `application/json` and an `Origin` that matches the host (or `HOMI_PUBLIC_URL`).
- Public view (off by default) exposes only services not marked hidden, with status only.

## Outbound requests (SSRF)
All server-side requests use `safeFetch`: http(s) only, no URL credentials, DNS results checked at connect time, redirects re-validated (max 3), 5 MB / 10 s caps. Always blocked: `0.0.0.0/8`, `169.254.0.0/16` (cloud metadata), IPv6 link-local, multicast. Loopback is blocked unless enabled. An ESLint rule forbids raw `fetch` in server code.

## Secrets at rest
Secrets use AES-256-GCM with a key derived (HKDF) from `HOMI_SECRET_KEY`, bound to their record via AAD. If you lose the key, stored secrets cannot be recovered. YAML export never includes secrets.

## Known limits (v0.1)
- CSP is not yet nonce-based (Next inline scripts) and no `frame-ancestors` header is set yet.
- Single replica only (in-process scheduler, SQLite).
