# EVY

If smartphones and the internet were built by the people for the people. Create services on the EVY platform and get paid every time your contribution is used. The EVY app is privacy-focused, local-first and peer-to-peer.

## Architecture

```mermaid
flowchart LR
    ios[iOS app]
    web[Web builder]

    api[api JSON-RPC WebSocket gateway]
    marketplace[marketplace service gRPC evy.Service]
    evyDb[(Postgres evy DB)]
    mpDb[(Postgres marketplace DB)]

    ios -- WebSocket --> api
    web -- WebSocket --> api
    api -- evy core resource handlers / Drizzle --> evyDb
    api -- service marketplace gRPC --> marketplace
    marketplace -- Drizzle --> mpDb
```

## Documentation

- EVY Platform
  - [Data](./docs/evy/data.md)
  - [Functions](./docs/evy/functions.md)
  - [Server Driven UI](./docs/evy/sdui.md)
  - [API](./api/README.md)
  - [iOS](./ios/README.md)
  - [Web](./web/README.md)
  - [Android](./android/README.md)
- [Marketplace](./services/marketplace/README.md)
  - [Data models](./docs/services/marketplace/data.md)
  - [Example data](./docs/services/service_data.json)
  - [Example UI flow for view & create item pages](./docs/services/service_sdui.json)

## Setup

1. Install [Bun](https://bun.sh/)
2. Install [Docker](https://www.docker.com/)
3. Copy `.env.example` to `.env`

## Running Services

### Development

#### All-in-one with Docker

Run Postgres, the marketplace service, the main API, and the web app:

```bash
docker compose up --build
```

#### Postgres + Bun dev for all apps

Start Postgres (`docker compose up --build postgres`), then in separate terminals from the repo root:

```bash
bun install
bun run db:seed

cd services/marketplace && bun run dev
cd api && bun run dev
cd web && bun run dev
```

### Production (with Docker Compose)

Uses pre-built images from GitHub Container Registry (requires authentication):

```bash
docker compose -f docker-compose.prod.yml up
```

## End to end testing

`./run-e2e.sh` runs API, web, and iOS end-to-end tests with Docker Compose.

You can optionally skip the iOS tests (which are heavy and slow) by running `./run-e2e.sh --skip-ios`

The `--ci` flag is intended for CI only and is not meant for regular local runs. It runs API, marketplace, and web directly with Bun and expects PostgreSQL to already be running on the host. It exists because the macOS CI runner cannot run a container runtime (no nested virtualization), so PostgreSQL is provided on the host instead. For local development, use `./run-e2e.sh` (or `./run-e2e.sh --skip-ios`) rather than `--ci`.

## CI

- API lint, build, and tests, and web lint run on Linux.
- Web tests run on Linux and install Playwright before running.
- E2E tests run on macOS with `./run-e2e.sh --ci`. PostgreSQL is started on the host (the macOS runner cannot run Docker), then API, marketplace, web, and iOS Simulator tests run with Bun. iOS tests target iPhone 17 / iOS 26.5.
