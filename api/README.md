# EVY API

WebSocket API that routes data requests to the proper service, handles evy core resources, and pushes/forwards `dataChanged` notifications when data changes.

## Architecture

### Request dispatch

Incoming JSON-RPC messages are authenticated where required, validated, then dispatched based on `service`. Requests for `service: "evy"` are handled by evy core resource modules. All other services are forwarded to the appropriate backend over JSON-RPC (WebSocket).

```mermaid
sequenceDiagram
    participant Client
    participant index as index.ts
    participant rpc as procedures/rpc.ts
    participant data as data/data.ts
    participant resource as data resources
    participant services as procedures/services.ts
    participant marketplace as marketplace (JSON-RPC WS)

    Client->>index: JSON-RPC get create update delete api
    index->>index: auth for protected methods
    index->>rpc: registered handler
    rpc->>rpc: validateStrict*Request

    alt service == "evy"
        rpc->>data: core dispatch
        data->>resource: resource-specific handler
        resource-->>data: row JSON
        data-->>rpc: row JSON
    else service != "evy"
        rpc->>services: forwardGet/Create/Update
        services->>marketplace: JSON-RPC get/create/update
        marketplace-->>services: validated response
        services-->>rpc: row JSON
    end

    rpc-->>index: JSON-RPC response
    index-->>Client: JSON-RPC response
```

### Notifications

The server emits `dataChanged` JSON-RPC notifications to all subscribed clients when data changes, both for evy core resources and remote service events:

```mermaid
sequenceDiagram
    participant Client as Subscribed clients
    participant index as index.ts
    participant data as data/data.ts
    participant resource as data resources
    participant services as procedures/services.ts
    participant marketplace as marketplace (JSON-RPC WS)

    Note over resource,index: Core evy write triggers notification
    resource->>data: emit callback
    data->>index: broadcast dataChanged payload
    index->>Client: JSON-RPC notification

    Note over marketplace,index: Remote service event triggers notification
    marketplace->>services: dataChanged JSON-RPC notification
    services->>index: broadcast event payload
    index->>Client: JSON-RPC notification
```

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- PostgreSQL database (or use Docker Compose)

Copy [`.env.example`](../.env.example) to `../.env` and follow the comments there.

## Getting Started

### Installation

```bash
bun install
```

### Database Setup

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
```

All required env vars (database connection, service WebSocket hosts, etc.) must be provided at runtime. See the root [`.env.example`](../.env.example) for the full list.

### Docker Compose

From the repo root: `docker compose up -d api` (same stack as [README § Development (with Docker Compose)](../README.md#development-with-docker-compose)). Optional API-only file: [`compose.yml`](./compose.yml) here (service `app`, `env_file` → root `.env`).

### Health checks

```bash
bun run health
bun run health:seeded
```

Env vars must be exported in the shell or provided via Docker — they are not loaded from `.env` automatically.

## Available Scripts

| Script                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `bun run dev`           | Start server with hot reload             |
| `bun run build`         | Build for production                     |
| `bun run start`         | Run migrations and start server          |
| `bun run health`        | Run the readiness check                  |
| `bun run health:seeded` | Run readiness check and require seed data |
| `bun run test:unit`     | Run API unit tests                       |
| `bun run test:e2e`      | Run API end-to-end tests                 |
| `bun run lint`          | Run Biome linter                         |
| `bun run format`        | Format files with Biome                  |
| `bun run db:generate`   | Generate migration from schema changes   |
| `bun run db:migrate`    | Apply pending migrations                 |
| `bun run db:push`       | Push schema directly (dev only)          |
| `bun run db:studio`     | Open Drizzle Studio UI                   |

## File Upload

Files are stored at `api/public/files/{id}` (excluded from git). File metadata is an evy core resource (`service: "evy"`, `resource: "files"`). Maximum upload size is 20 MB. For production deployments, migrate to S3 or a CDN while keeping file IDs stable.
