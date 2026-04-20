# EVY API

Main API for EVY. A JSON-RPC 2.0 WebSocket server (via [`rpc-websockets`](https://github.com/elpheria/rpc-websockets)) that handles `service: "evy"` in-process (SDUI flows and core tables), forwards other services over gRPC, and pushes real-time `dataUpdated` / `flowUpdated` notifications to connected clients.

## Architecture

### System view

The API is the only public edge for iOS and the web builder. Requests are validated against [`types/schema/rpc/`](../types/schema/rpc) and routed by **`service` + `resource`** in [`src/rpc.ts`](./src/rpc.ts): `service === "evy"` goes to [`src/data.ts`](./src/data.ts); any other registered service uses [`src/services.ts`](./src/services.ts) to call gRPC. Every non-`evy` service must declare `${SERVICE}_GRPC_HOST` and `${SERVICE}_GRPC_PORT` (see `SERVICE_VALUES` in generated types / [`src/services.ts`](./src/services.ts)).

```mermaid
flowchart LR
    ios[iOS app]
    web[Web builder]

    subgraph api_process [api process]
        ws[ws.ts<br/>JSON-RPC 2.0 server]
        rpc[rpc.ts<br/>get / upsert dispatch]
        data[data.ts<br/>local evy store]
        services[services.ts<br/>gRPC clients + events]
        validation[validation.ts]
    end

    subgraph marketplace_process [marketplace service]
        grpc[grpc/server.ts<br/>evy.Service]
        mdata[data.ts]
    end

    pg[(Postgres<br/>evy + marketplace DBs)]

    ios -- WebSocket JSON-RPC --> ws
    web -- WebSocket JSON-RPC --> ws
    ws --> rpc
    rpc --> data
    rpc --> services
    services -- gRPC evy.Service --> grpc
    data --> pg
    grpc --> mdata
    mdata --> pg
```

### Request dispatch

`get` is public, `upsert` is protected (requires a valid device token via `validateAuth`). Params include **`service`**, **`resource`**, optional **`filter.id`**, and for `upsert` a **`data`** object (see JSON Schemas under `types/schema/rpc/`).

- **`service: "evy"`** &mdash; handled entirely in [`src/data.ts`](./src/data.ts). Supported resources include `sdui` (flows / `flow` table), `devices` (via auth only for writes), `organisations`, `services`, and `providers` (typed catalog tables). There is no generic `evy` “data” table routed through `services.ts`.
- **`service` ≠ `"evy"`** (e.g. `marketplace`) &mdash; [`src/rpc.ts`](./src/rpc.ts) calls `forwardUnary` in [`src/services.ts`](./src/services.ts), which issues `Get` / `Upsert` on `evy.Service` and validates JSON responses.

```mermaid
sequenceDiagram
    participant C as Client (iOS / web)
    participant WS as ws.ts
    participant RPC as rpc.ts
    participant D as data.ts (local)
    participant S as services.ts
    participant MP as marketplace (gRPC)

    C->>WS: JSON-RPC upsert { service, resource, filter?, data }
    WS->>WS: validateAuth(token, os) if protected
    WS->>RPC: upsert(params)
    RPC->>RPC: validateStrictUpsertRequest(params)

    alt service == "evy"
        RPC->>D: upsertCoreForValidatedRequest(params)
        D-->>RPC: row
        RPC->>WS: emitJsonRpc(notification, row)
        Note over RPC,WS: flowUpdated if resource is sdui else dataUpdated
        WS-->>C: JSON-RPC notification
    else service != "evy"
        RPC->>S: forwardUnary(service, "upsert", params)
        S->>MP: gRPC Upsert (JSON in data_json / result_json)
        MP-->>S: row JSON
        S-->>RPC: row
        Note over S,WS: SubscribeEvents stream forwards remote events<br/>through emitJsonRpc (e.g. dataUpdated)
    end

    RPC-->>WS: row
    WS-->>C: JSON-RPC response
```

### Real-time notifications

`ws.ts` registers two server events (`dataUpdated`, `flowUpdated`) and ships a custom `emitJsonRpc` helper because `rpc-websockets` emits a non-standard wire shape that `JsonRPC.swift` on iOS cannot parse. All pushed frames therefore use standard JSON-RPC 2.0:

```json
{ "jsonrpc": "2.0", "method": "dataUpdated", "params": { /* row */ } }
```

- Successful **`evy`** upserts call `emitJsonRpc` from [`src/rpc.ts`](./src/rpc.ts): `flowUpdated` when `resource === "sdui"`, otherwise `dataUpdated`.
- Remote services emit named events on `evy.Service.SubscribeEvents`; [`src/services.ts`](./src/services.ts) parses `payload_json` and forwards them with the same `emitJsonRpc` helper (reconnect with exponential backoff).

### Internal module layout

```mermaid
flowchart TD
    index[index.ts<br/>wires server + handlers]
    ws[ws.ts<br/>JSON-RPC transport]
    rpc[rpc.ts<br/>get / upsert routing]
    data[data.ts<br/>Drizzle + auth<br/>getCore / upsertCore]
    services[services.ts<br/>gRPC adapters + SubscribeEvents]
    validation[validation.ts<br/>Zod schemas + ISO date-time guard]
    readiness[readiness.ts<br/>health / seed check]
    drizzleTables[db/drizzleTables.ts<br/>re-exports generated schema]

    index --> ws
    index --> rpc
    index --> services
    rpc --> data
    rpc --> services
    rpc --> ws
    data --> validation
    data --> drizzleTables
    services --> ws
    readiness --> rpc
```

- `db/drizzleTables.ts` simply re-exports `types/generated/ts/db/schema.generated.ts`; the schema itself comes from `types/schema/data/` via `bun run types:generate`.
- `validation.ts` enforces that any JSON key ending in `At` or `_timestamp` (plus explicit exceptions) is an ISO 8601 string &mdash; never a Unix number &mdash; before it reaches Postgres.

### Shared contracts

| File | Purpose |
|------|---------|
| [`types/schema/service.proto`](../types/schema/service.proto) | `evy.Service` gRPC IDL implemented by every non-`evy` backend |
| [`types/schema/data/data.schema.json`](../types/schema/data/data.schema.json) | JSON Schema for `DATA_EVY_*` rows |
| [`types/schema/sdui/evy.schema.json`](../types/schema/sdui/evy.schema.json) | `UI_Flow` / `UI_Page` / `UI_Row` contract |
| [`types/schema/rpc/*.schema.json`](../types/schema/rpc) | `GetRequest` / `UpsertRequest` / `GetResponse` contracts |

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- PostgreSQL database (or use Docker Compose)

Ensure your root env file (`../.env`) is set with the .env.example. The following environment variables are used by the API:

```env
API_PORT=8000
DB_USER=evy
DB_PASS=evy
DB_PORT=5432
DB_DOMAIN=localhost
DB_EVY_DATABASE=evy
# Required for each non-evy service (URL is host:port); see api/src/services.ts
MARKETPLACE_GRPC_HOST=0.0.0.0
MARKETPLACE_GRPC_PORT=8001
```

## Getting Started

### Installation

```bash
bun install
```

### Database Setup

Run migrations to set up the database schema:

```bash
bun run db:migrate
```

### Running the dev server with hot-reload

```bash
bun run dev
```

### Docker

```bash
docker build -t evy-api .
docker run -p 8000:8000 \
  -e DB_USER="user" \
  -e DB_PASS="password" \
  -e DB_PORT="5432" \
  -e DB_DOMAIN="host" \
  -e DB_EVY_DATABASE="evy" \
  -e MARKETPLACE_GRPC_HOST="marketplace" \
  -e MARKETPLACE_GRPC_PORT="8001" \
  evy-api
```

### Docker Compose

From the repo root (the API has no `docker-compose.yml` in its directory):

```bash
docker compose up -d api
```

## Available Scripts

| Script                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `bun run dev`          | Start server with hot reload             |
| `bun run build`        | Build for production                     |
| `bun run start`        | Run migrations and start server          |
| `bun run health`       | Run the readiness check                  |
| `bun run health:seeded` | Run readiness check and require seed data |
| `bun run test`         | Run API unit and integration tests       |
| `bun run test:e2e`     | Run API end-to-end tests                 |
| `bun run lint`         | Run Biome linter                         |
| `bun run format`       | Format files with Biome                  |
| `bun run db:generate`  | Generate migration from schema changes   |
| `bun run db:migrate`   | Apply pending migrations                 |
| `bun run db:push`      | Push schema directly (dev only)          |
| `bun run db:studio`    | Open Drizzle Studio UI                   |
