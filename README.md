# EVY

If smartphones and the internet were built by the people for the people. Create services on the EVY platform and get paid every time your contribution is used. The EVY app is privacy-focused, local-first and peer-to-peer.

- [docs](/docs/README.md)
- [api](/api/README.md)
- [web](/web/README.md)
- [iOS](/ios/README.md)
- [Android](/android/README.md)

## Shared types (schema-first)

Cross-platform contracts live in **`types/`** at the repo root.

- **Source of truth:** `types/schema/` — JSON Schema files for SDUI types and JSON-RPC payloads.
- **Generated manually:** `types/generated/ts/` (TypeScript) and `types/generated/swift/` (Swift).

**Commands (from repo root):**

- `bun run types:generate` — regenerate TS and Swift from schemas.

After changing any schema (including `types/schema/data/`), run `bun run types:generate` and commit the updated files under `types/generated/`.

## Setup

1. Install [Bun](https://bun.sh/)
2. Install [Docker](https://www.docker.com/)
3. Copy `.env.example` to `.env`

## Running Services

### Development (with Docker Compose)

Run Postgres via Docker and run the API and web app locally:

```bash
docker compose up --build postgres
bun install
bun run db:seed

cd api
bun install
bun run dev
```

In another terminal, from the repo root:

```bash
cd web
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

## Testing

### Unit and integration tests

```bash
cd api && bun run test    # API tests
cd web && bun run test    # Web Playwright tests (requires `bun run test:setup` first)
```

### E2E tests

The `run-e2e.sh` script runs API, web, and (optionally) iOS end-to-end tests.

**With Docker** (builds and runs all services in containers):

```bash
./run-e2e.sh --skip-ios
```

**Without Docker** (faster -- runs API and web directly via Bun, with Postgres provided separately, for example via Docker):

```bash
docker compose up -d postgres
./run-e2e.sh --skip-ios --no-docker
```

| Flag | Description |
|------|-------------|
| `--skip-ios` | Skip iOS e2e tests (required on machines without Xcode/simulator) |
| `--no-docker` | Run API and web as local Bun processes instead of Docker containers |

### CI

CI uses a custom Docker image with Playwright, Bun, and PostgreSQL pre-installed (`ghcr.io/evy-platform/evy-ci`). The E2E workflow starts PostgreSQL from inside that image instead of pulling a separate GitHub Actions service container.

If you change `.github/images/ci/Dockerfile`, rebuild and publish the CI image before depending on the new tools in a workflow. See `.github/images/ci/Dockerfile` and `.github/workflows/push-ci-image.yml`.
