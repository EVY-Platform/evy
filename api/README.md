# EVY API

RPC-websockets based API server using Bun and Drizzle ORM.

Shared types for RPC params and SDUI models are generated from `types/schema/` at the repo root. The API imports them via the `evy-types` path alias (see `tsconfig.json`). The Drizzle schema (`src/db/schema.generated.ts`) is also generated from `types/schema/data/`. After changing any schema, run `bun run types:generate` from the repo root and commit the updated `types/generated/` and `api/src/db/schema.generated.ts` files.

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- PostgreSQL database (or use Docker Compose)

## Environment Variables

Create a `.env` file with the following variables:

```env
API_PORT=8000
DB_USER=evy
DB_PASS=evy
DB_PORT=5432
DB_DOMAIN=localhost
DB_DATABASE=evy
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

### Running the Server

#### Development Mode

```bash
bun run dev
```

This starts the server with hot reloading on file changes.

#### Production Mode

```bash
bun run start
```

The server runs on port 8000 by default (configurable via `API_PORT` env var).

## Docker

### Build and Run

```bash
docker build -t evy-api .
docker run -p 8000:8000 --env-file .env evy-api
```

### Using Docker Compose

```bash
docker compose up -d
```

## Database Migrations (Drizzle)

### Workflow

1. Make changes to `src/db/schema.ts`
2. Generate a new migration: `bun run db:generate`
3. Apply the migration: `bun run db:migrate`

### Development

For quick schema iteration during development, you can push changes directly without generating migration files:

```bash
bun run db:push
```

### Drizzle Studio

To visually explore and manage your database:

```bash
bun run db:studio
```

## Available Scripts

| Script                | Description                            |
| --------------------- | -------------------------------------- |
| `bun run dev`         | Start server with hot reload           |
| `bun run start`       | Run migrations and start server        |
| `bun run build`       | Build for production                   |
| `bun run lint`        | Run Biome linter                       |
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:migrate`  | Apply pending migrations               |
| `bun run db:push`     | Push schema directly (dev only)        |
| `bun run db:studio`   | Open Drizzle Studio UI                 |
