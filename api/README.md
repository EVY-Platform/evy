# EVY API

Main API for EVY. A JSON-RPC 2.0 WebSocket server (via [`rpc-websockets`](https://github.com/elpheria/rpc-websockets)) that handles `service: "evy"` in-process (SDUI flows and core tables), forwards other services over gRPC, and pushes real-time `dataChanged` notifications to connected clients.

Monorepo setup (Compose, seeding, local Bun): [README § Running Services](../README.md#running-services).

## Architecture

### System view

High-level diagram (iOS / web / API / marketplace / Postgres): [README § Architecture at a glance](../README.md#architecture-at-a-glance).

The API is the only public edge for iOS and the web builder. Requests are validated against [`types/schema/rpc/`](../types/schema/rpc) and routed by `service` + `resource` in [`src/procedures/rpc.ts`](./src/procedures/rpc.ts): `service === "evy"` goes to [`src/data/`](./src/data/); any other registered service uses [`src/procedures/services.ts`](./src/procedures/services.ts) to call gRPC. Every non-`evy` service must declare `${SERVICE}_GRPC_HOST` and `${SERVICE}_GRPC_PORT` (see `SERVICE_VALUES` in generated types / [`src/procedures/services.ts`](./src/procedures/services.ts)).

### Request dispatch

`get` and `api` are public read methods. `create`, `update`, `delete`, `sync`, and `cancelUpload` are protected (require a valid device token via `validateAuth`). Binary upload frames are also ignored unless they arrive on an authenticated WebSocket. Write params include `service`, `resource`, `data`, and an optional `filter` object for `create`; `update` and `delete` require `filter.id`.

- `service: "evy"` &mdash; handled entirely under [`src/data/`](./src/data/). Supported resources include `sdui` (flows / `flow` table), `devices` (via auth only for writes), `organisations`, `services`, `providers` (typed resource tables), and `images` (image metadata / `image` table). There is no generic `evy` "data" table routed through `services.ts`.
- `service` ≠ `"evy"` (e.g. `marketplace`) &mdash; [`src/procedures/rpc.ts`](./src/procedures/rpc.ts) calls `forwardGet`, `forwardCreate`, or `forwardUpdate` in [`src/procedures/services.ts`](./src/procedures/services.ts), which issue `Get`, `Create`, or `Update` on `evy.Service` and validate JSON responses. `delete` is currently limited to evy core resources.
- **`sync`** is a protected RPC that unifies startup data loading into a single call. Params are `{ lastSyncTime }` (ISO date-time). The response returns **all** changed rows across every registered service (evy core SDUI/resources + external services) since that timestamp. When data changed, the response also includes the full resource registry. Response shape: `{ data: [{ service, resource, value }], resources?: { resources, resourcesByService } }`. Clients should store data rows under service-qualified keys (`evy:sdui`, `marketplace:items`, etc.) and apply the resource mapping for binding resolution when present. `devices` is excluded (auth-only).

Synchronous request/response path:

```mermaid
sequenceDiagram
    participant Client
    participant ws as ws.ts
    participant rpc as procedures/rpc.ts
    participant data as data/core.ts
    participant services as procedures/services.ts
    participant marketplace as marketplace (gRPC)

    Client->>ws: JSON-RPC create/update/delete
    ws->>ws: auth (validateAuth) for protected methods
    ws->>rpc: registered handler
    rpc->>rpc: validateStrict*Request

    alt service == "evy"
        rpc->>data: core resource handler
        data-->>rpc: row
    else service != "evy"
        rpc->>services: forwardGet/Create/Update
        services->>marketplace: gRPC Get/Create/Update
        marketplace-->>services: row JSON
        services-->>rpc: row
    end

    rpc-->>ws: JSON-RPC response (row)
    ws-->>Client: JSON-RPC response (row)
```

Notification fan-out paths:

```mermaid
sequenceDiagram
    participant Client as Subscribed clients
    participant ws as ws.ts
    participant data as data/core.ts
    participant services as procedures/services.ts
    participant marketplace as marketplace (gRPC)

    Note over data,ws: Core evy write triggers notification
    data->>ws: emitJsonRpc(dataChanged, changed row)
    ws->>Client: JSON-RPC notification

    Note over marketplace,ws: Remote service event triggers notification
    marketplace->>services: SubscribeEvents payload
    services->>services: parse payload_json
    services->>ws: emitJsonRpc(event, data)
    ws->>Client: JSON-RPC notification
```

### Real-time notifications

`ws.ts` registers the `dataChanged` server event and ships a custom `emitJsonRpc` helper because `rpc-websockets` emits a non-standard wire shape that `JsonRPC.swift` on iOS cannot parse. All pushed frames therefore use standard JSON-RPC 2.0:

```json
{ "jsonrpc": "2.0", "method": "dataChanged", "params": { "service": "evy", "resource": "sdui", "operation": "create", "value": { /* row */ } } }
```

- [`src/index.ts`](./src/index.ts) creates a `broadcast` callback wrapping `emitJsonRpc` and injects it into `rpc` and `services` at startup.
- Successful syncable `evy` writes emit `dataChanged` from [`src/data/`](./src/data/), including SDUI. Payloads include the write operation: `{ service, resource, operation, value }`.
- Remote services emit named events on `evy.Service.SubscribeEvents`; [`src/procedures/services.ts`](./src/procedures/services.ts) parses `payload_json` and forwards them via the same broadcast callback (reconnect with exponential backoff). Remote `dataChanged` payloads use the same `{ service, resource, operation, value }` shape.
- The shared [`src/broadcast.ts`](./src/broadcast.ts) defines the `BroadcastFn` type contract, decoupling `rpc` and `services` from the WebSocket layer.

### Internal module layout

```mermaid
flowchart TD
    index[index.ts wires server handlers broadcast]
    ws[ws.ts JSON-RPC transport]
    rpc[procedures/rpc.ts request routing]
    data[data directory evy core resources]
    db[data/db.ts Drizzle client]
    services[procedures/services.ts gRPC adapters SubscribeEvents]
    sync[procedures/sync.ts unified sync handler]
    uploads[procedures/uploads.ts binary upload sessions]
    readiness[readiness.ts health seed check]

    index --> ws
    index --> rpc
    index --> data
    index --> services
    index --> uploads
    rpc --> data
    rpc --> services
    rpc --> sync
    data --> db
    data --> uploads
    ws --> uploads
    sync --> data
    sync --> services
    readiness --> rpc
```

- `src/data/db.ts` owns the Drizzle client and imports API tables directly from `types/generated/ts/db/schema.generated.ts`; `src/data/` owns evy core resource procedures.
- Upload sessions live in memory in `src/procedures/uploads.ts`; `src/data/images.ts` persists the validated image binary and metadata.
- The schema comes from `types/schema/data/` and `types/schema/images/` via `bun run types:generate`.
- Validators are imported directly from `evy-types/validators` and `evy-types/rpcRequestHelpers` (no local wrapper file).

### Shared contracts

Broader schema layout: [docs/evy/types.md § Sources](../docs/evy/types.md#sources). Commonly used paths:

| File | Purpose |
|------|---------|
| [`types/schema/service.proto`](../types/schema/service.proto) | `evy.Service` gRPC IDL implemented by every non-`evy` backend |
| [`types/schema/data/data.schema.json`](../types/schema/data/data.schema.json) | JSON Schema for `DATA_EVY_*` persistence rows, including image metadata |
| [`types/schema/images/image.schema.json`](../types/schema/images/image.schema.json) | Shared image metadata, binary response, upload chunk, and image-specific RPC param models |
| [`types/schema/sdui/evy.schema.json`](../types/schema/sdui/evy.schema.json) | `UI_Flow` / `UI_Page` / `UI_Row` contract |
| [`types/schema/rpc/*.schema.json`](../types/schema/rpc) | `GetRequest` / `CreateRequest` / `UpdateRequest` / `DeleteRequest` / `GetResponse` contracts |

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- PostgreSQL database (or use Docker Compose)

Copy [`.env.example`](../.env.example) to `../.env` (see comments there). API-relevant variables include:

```env
API_PORT=8000
DB_USER=evy
DB_PASS=evy
DB_PORT=5432
DB_DOMAIN=localhost
DB_EVY_DATABASE=evy
# Required for each non-evy service (dial target host:port for the API); see api/src/procedures/services.ts
# Local processes on the host: use 127.0.0.1. Docker Compose overrides use the service name `marketplace`.
MARKETPLACE_GRPC_HOST=127.0.0.1
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

From the repo root: `docker compose up -d api` (same stack as [README § Development (with Docker Compose)](../README.md#development-with-docker-compose)). Optional API-only file: [`compose.yml`](./compose.yml) here (service `app`, `env_file` → root `.env`).

### Health checks

`bun run health` and `bun run health:seeded` invoke `src/readiness.ts` **without** `--env-file=../.env` (unlike `dev`, `start`, and `test:unit`). Export variables from the root `.env` in your shell, rely on Docker Compose `environment` / `env_file`, or run readiness from an environment where `DB_*` and `API_PORT` are already set.

## Available Scripts

| Script                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `bun run dev`          | Start server with hot reload             |
| `bun run build`        | Build for production                     |
| `bun run start`        | Run migrations and start server          |
| `bun run health`       | Run the readiness check                  |
| `bun run health:seeded` | Run readiness check and require seed data |
| `bun run test:unit`    | Run API unit tests                       |
| `bun run test:e2e`     | Run API end-to-end tests                 |
| `bun run lint`         | Run Biome linter                         |
| `bun run format`       | Format files with Biome                  |
| `bun run db:generate`  | Generate migration from schema changes   |
| `bun run db:migrate`   | Apply pending migrations                 |
| `bun run db:push`      | Push schema directly (dev only)          |
| `bun run db:studio`    | Open Drizzle Studio UI                   |

## Image Upload

### `images` EVY core resource

Image metadata is stored in the `Image` table (evy core, `service: "evy"`, `resource: "images"`). Metadata rows contain `id`, `type`, `createdAt`, and `updatedAt`. Supported types: `image/jpeg`, `image/png`. The shared image schema lives at [`types/schema/images/image.schema.json`](../types/schema/images/image.schema.json). Maximum upload size: 20 MB.

Binary image data is stored at `api/public/images/{id}.{ext}`. Upload directories are excluded from git (see `api/.gitignore`). For production deployments, migrate to S3 or a CDN while keeping image IDs stable.

### Generic binary upload frame protocol

Binary payloads are staged as a sequence of authenticated binary WebSocket frames (not JSON-RPC). The API keeps staged chunks in memory until the upload is finalised with `create` or discarded with `cancelUpload`, so clients should finalise or cancel promptly. Each frame has the format:

```
[4-byte big-endian metadataLength][metadata JSON bytes][raw bytes]
```

The metadata JSON has the shape:

```json
{ "type": "image/jpeg", "uploadId": "<uuid>", "index": 0, "byteOffset": 0, "byteLength": 12345 }
```

- `uploadId` — a client-generated UUID identifying the upload session. For image creation, this should be the future image id.
- `type` — payload media type. Image creation currently supports `image/jpeg` and `image/png`.
- `index` — zero-based sequential chunk index.
- `byteOffset` — byte offset of this chunk within the full upload.
- `byteLength` — byte length of the chunk data following the metadata.

Chunks must arrive in order: each session starts with `index: 0` and `byteOffset: 0`, then increments by one chunk and the received byte count. Mismatched type, index, offset, length, or uploads over 20 MB are rejected.

### Creating images

After staging the binary upload, create the image through the normal protected `create` RPC:

```json
{
  "service": "evy",
  "resource": "images",
  "filter": { "id": "<uploadId>" },
  "data": {
    "id": "<uploadId>",
    "type": "image/jpeg",
    "createdAt": "2026-05-28T00:00:00.000Z",
    "updatedAt": "2026-05-28T00:00:00.000Z"
  }
}
```

`filter.id` is the uploaded binary id to consume. The API validates image bytes, writes the binary to disk, creates metadata, and emits the normal `dataChanged` notification for `resource: "images"`. The server owns `createdAt` and `updatedAt` on insert, so client-supplied timestamps are only used to satisfy shared schema shape.

### Reading and syncing images

The generic `get` method supports `service: "evy"`, `resource: "images"` with optional `filter.id` or `filter.updatedAfter`. Responses are arrays of `{ id, type, createdAt, updatedAt, dataBase64 }`, ordered by `updatedAt` and `id`. Because `images` is an evy core resource, `sync` can also include changed images in the same response shape.

### RPCs

| Method | Auth | Description |
|--------|------|-------------|
| `create` | protected | For `service: "evy"`, `resource: "images"`, finalises a staged binary upload and creates image metadata. |
| `delete` | protected | For `service: "evy"`, `resource: "images"`, deletes image binary and metadata. Params include `filter: { id }`. Returns the deleted metadata row. |
| `cancelUpload` | protected | Discard an in-progress generic upload session. Params: `{ uploadId }`. Returns `{ ok: true }`. |
| `get` | public | For `service: "evy"`, `resource: "images"`, returns image metadata + base64 binary rows. Use `filter: { id }` to fetch a single image or `filter.updatedAfter` for incremental reads. |
