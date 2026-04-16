# EVY Marketplace service

gRPC server for marketplace **domain data only** (catalog rows). SDUI flows are stored and served by the main `api`. The marketplace service implements `evy.Service` from [`types/schema/service.proto`](../../types/schema/service.proto). The `api` registers a gRPC client in [`api/src/services.ts`](../../api/src/services.ts) (using `MARKETPLACE_GRPC_URL`) and proxies non-SDUI marketplace traffic here; clients still use WebSockets only to the main API.

## Environment

Uses the root `.env` file. Required variables include:

- `MARKETPLACE_API_PORT` — gRPC listen port (default `8001` in compose)
- `DB_*` — Postgres host credentials; database name for this service is `MARKETPLACE_DB_DATABASE` (default `marketplace`)

## Scripts

Same pattern as the top-level `api/` package: `bun run dev`, `bun run db:migrate`, `bun run health`, etc.

## Docker

From repo root:

```bash
docker compose -f services/marketplace/compose.yml up --build
```

The dev stack in the repo root also builds this service; see root `docker-compose.yml`.
