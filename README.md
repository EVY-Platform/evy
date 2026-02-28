# EVY

If smartphones and the internet were build by the people for the people. Create services on the EVY platform and get paid everytime your contribution is used. The EVY app is privacy-focused, local-first and peer-to-peer.

- [docs](/docs/README.md)
- [api](/api/README.md)
- [web](/web/README.md)
- [iOS](/ios/README.md)
- [Android](/android/README.md)

## Shared types (schema-first)

Cross-platform contracts live in **`types/`** at the repo root.

- **Source of truth:** `types/schema/` — JSON Schema files for SDUI types and JSON-RPC payloads.
- **Generated:** `types/generated/ts/` (TypeScript) and `types/generated/swift/` (Swift). These are committed; do not edit by hand.

**Commands (from repo root):**

- `bun run types:generate` — regenerate TS and Swift from schemas.
- `bun run types:check` — fail if generated files differ (used in CI).

After changing any schema (including `types/schema/data/`), run `bun run types:generate` and commit the updated files under `types/generated/` and `api/src/db/schema.generated.ts`.

## Setup

1. Install [Bun](https://bun.sh/)
2. Install [Docker](https://www.docker.com/)
3. Copy `.env.example` to `.env`

## Running Services

### Development (with Docker Compose)

For example run api manually but the rest with docker:

```bash
docker compose up --build postgres web
bun install
bun run db:seed

cd api
bun install
bun run dev
```

### Production (with Docker Compose)

Uses pre-built images from GitHub Container Registry (requires authentication):

```bash
docker compose -f docker-compose.prod.yml up
```

### Running Services Separately

#### API

```bash
cd api
bun install
bun run dev
```

Or with Docker:

```bash
cd api
docker build -t evy-api .
docker run -p 8000:8000 \
  -e DB_USER="user" \
  -e DB_PASS="password" \
  -e DB_PORT="5432" \
  -e DB_DOMAIN="host" \
  -e DB_DATABASE="evy" \
  evy-api
```

#### Web

```bash
cd web
bun install
bun run dev
```

Or with Docker:

```bash
cd web
docker build -t evy-web .
docker run -p 3000:3000 evy-web
```

See individual README files for more details.
