# WriteNow Assessment Write-up

## Stack justifications

- **Node.js + Express:** fast to prototype and deploy with low memory overhead on `t2.micro`.
- **SQLite + better-sqlite3:** zero-ops persistence with excellent simplicity for a single-node service.
- **EJS + vanilla CSS:** no build pipeline required and ideal for a lightweight admin dashboard.
- **Caddy:** minimal reverse proxy configuration and reliable containerized operation.
- **Docker Compose:** one-command lifecycle and reproducible infrastructure.
- **Basic Auth:** low-complexity protection for admin-only mutation endpoints.

## Idempotency & race condition handling

The `links.long_url` column is unique. The service first checks for an existing row, then attempts insert with a generated slug. If a concurrent request races and triggers a unique constraint, it re-queries by `long_url` and returns the existing slug. This prevents duplicate records and still handles rare slug collisions.

## With R500/month, what I would improve

I would add managed Postgres (automated backups, better concurrent writes), centralized observability (Grafana Cloud + Loki), and secret management (AWS Secrets Manager or Doppler) while keeping Cloudflare Tunnel in front of the service.

## Hardest part and solution

The hardest part was balancing route security so `/` is protected while `/:slug` remains public. I solved it by combining app-level Basic Auth with Cloudflare Access path policy ordering (bypass non-root paths, enforce OTP on root dashboard path).

## Estimated total time spent

Roughly 11-14 hours including implementation, deployment hardening, Cloudflare setup, load testing, and documentation.
