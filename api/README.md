# EVY API

Main API for EVY. A JSON-RPC 2.0 WebSocket server (via [`rpc-websockets`](https://github.com/elpheria/rpc-websockets)) that persists SDUI flows with Drizzle/Postgres, forwards all non-SDUI traffic to backend services over gRPC, and pushes real-time `dataUpdated` / `flowUpdated` notifications to connected clients.

## Architecture

### System view

The API is the only public edge for iOS and the web builder; it fans out to per-namespace backend services. Every non-`evy` namespace (currently only `marketplace`) must declare its gRPC address via `<NAMESPACE>_GRPC_URL` (host:port, no scheme).

```mermaid
flowchart LR
    ios[iOS app]
    web[Web builder]

    subgraph api_process [api process]
        ws[ws.ts<br/>JSON-RPC 2.0 server]
        rpc[rpc.ts<br/>get / upsert dispatch]
        data[data.ts<br/>local evy store]
        services[services.ts<br/>namespace router]
        validation[validation.ts]
        functions[functions.ts]
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

`get` is public, `upsert` is protected (requires a valid device token via `validateAuth`). Both carry a `namespace` + `resource` pair:

- `namespace: "evy"` **and** `resource: "sdui"` &mdash; read/write `UI_Flow` documents in the local `flow` table.
- Every other `(namespace, resource)` pair &mdash; proxied to the matching gRPC backend. `evy` arbitrary resources (non-`sdui`) are served locally from the `data` table via the local adapter in `services.ts`.

```mermaid
sequenceDiagram
    participant C as Client (iOS / web)
    participant WS as ws.ts
    participant RPC as rpc.ts
    participant D as data.ts (local)
    participant S as services.ts
    participant MP as marketplace (gRPC)

    C->>WS: JSON-RPC upsert { namespace, resource, data }
    WS->>WS: validateAuth(token, os) if protected
    WS->>RPC: upsert(params)
    RPC->>RPC: validateRpcParams / assertUpsertShape

    alt resource == "sdui"
        RPC->>D: upsertCore({ namespace: "evy", ... })
        D->>D: validateFlowData (Zod)
        D-->>RPC: DATA_EVY_Flow
        RPC->>WS: emitJsonRpc("flowUpdated", row)
        WS-->>C: notification flowUpdated
    else other resource
        RPC->>S: forwardUpsert(namespace, params)
        alt namespace == "evy"
            S->>D: upsertCore(params)
            D-->>S: row
        else namespace != "evy"
            S->>MP: gRPC Upsert
            MP-->>S: row JSON
        end
        S-->>RPC: row
        Note over S,WS: SubscribeEvents stream fans "dataUpdated"<br/>notifications back through ws.ts
    end

    RPC-->>WS: row
    WS-->>C: JSON-RPC response
```

### Real-time notifications

`ws.ts` registers two server events (`dataUpdated`, `flowUpdated`) and ships a custom `emitJsonRpc` helper because `rpc-websockets` emits a non-standard wire shape that `JsonRPC.swift` on iOS cannot parse. All pushed frames therefore use standard JSON-RPC 2.0:

```json
{ "jsonrpc": "2.0", "method": "dataUpdated", "params": { /* row */ } }
```

- SDUI writes emit `flowUpdated` directly from `rpc.ts`.
- Non-SDUI writes emit `dataUpdated`. Local `evy` writes emit via an in-process `EventEmitter`; remote services emit by pushing onto `evy.Service.SubscribeEvents`, which `services.ts` keeps open with exponential-backoff reconnect and forwards through `emitJsonRpc`.

### Internal module layout

```mermaid
flowchart TD
    index[index.ts<br/>wires server + handlers]
    ws[ws.ts<br/>JSON-RPC transport]
    rpc[rpc.ts<br/>get / upsert routing]
    data[data.ts<br/>Drizzle + auth<br/>getCore / upsertCore]
    services[services.ts<br/>gRPC adapters + SubscribeEvents]
    validation[validation.ts<br/>Zod schemas + ISO date-time guard]
    functions[functions.ts<br/>server-side SDData helpers]
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
    services --> data
    services --> ws
    readiness --> rpc
```

- `db/drizzleTables.ts` simply re-exports `types/generated/ts/db/schema.generated.ts`; the schema itself comes from `types/schema/data/` via `bun run types:generate`.
- `functions.ts` mirrors the iOS/SDData formatters (see [Functions](../docs/evy/sddata/functions.md)) for scenarios where server-side evaluation of template functions is needed.
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
DB_DATABASE=evy
# Required for each non-evy namespace (host:port, no scheme); see api/src/services.ts
MARKETPLACE_GRPC_URL=localhost:8001
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
  -e DB_DATABASE="evy" \
  -e MARKETPLACE_GRPC_URL="marketplace:8001" \
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
