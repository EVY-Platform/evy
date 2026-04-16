# EVY

If smartphones and the internet were built by the people for the people. Create services on the EVY platform and get paid every time your contribution is used. The EVY app is privacy-focused, local-first and peer-to-peer.

# Documentation

- EVY Platform
  - [Types](./docs/evy/types.md)
  - [Data models](./docs/evy/sddata/data.md)
  - [Functions](./docs/evy/sddata/functions.md)
  - [Server Driven UI](./docs/evy/sdui/readme.md)
- Marketplace
  - [Data models](./docs/services/marketplace/data.md)
  - [Example data](./docs/services/service_data.json)
  - [Example UI flow for view & create item pages](./docs/services/service_sdui.json)
- [API](./api/README.md)
- [iOS](./ios/README.md)
- [Web](./web/README.md)

## Shared type system

Cross-platform contracts live in **`types/`**

- **Source of truth:** `types/schema/` — JSON Schema files for UI flow types (`UI_*`), shared data rows (`DATA_EVY_*`), and JSON-RPC payloads.
- **Generated manually:** `types/generated/ts/` and `types/generated/swift/`.

After changing any definitions in `types/schema/`, run `bun run types:generate`

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

## End to end testing

`./run-e2e.sh` runs API, web, and iOS end-to-end tests with docker

You can optionally skip the iOS tests (which are heavy and slow) by running `./run-e2e.sh --skip-ios`

For even faster run you can keep running the API and web directly via Bun, and postgres via docker, then run `./run-e2e.sh --skip-ios --no-docker`

## CI

CI uses a custom Docker image with Playwright, Bun, and PostgreSQL pre-installed (`ghcr.io/evy-platform/evy-ci`). The E2E workflow starts PostgreSQL from inside that image instead of pulling a separate GitHub Actions service container.

If you change `.github/images/ci/Dockerfile`, rebuild and publish the CI image before depending on the new tools in a workflow. See `.github/images/ci/Dockerfile` and `.github/workflows/push-ci-image.yml`.
