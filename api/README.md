# EVY API

RPC-websockets based API server using Bun and Drizzle ORM.

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- PostgreSQL database (or use Docker Compose)

## Environment Variables

Create a `.env` file with the following variables:

```env
API_PORT=8000
DB_USER=evy
DB_PASS=evy
DB_DATABASE=evy
DB_PORT=5432
DB_URL=postgresql://evy:evy@localhost:5432/evy
```

**Note:** Keep `localhost` in `.env` for local development. The Docker compose files automatically override `DB_URL` to use `host.docker.internal` for Docker networking.

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
docker run -p 8000:8000 -e DB_URL="postgresql://user:password@host:5432/evy" evy-api
```

### Using Docker Compose

```bash
docker compose up -d
```

Note: Ensure your `.env` file contains the `DB_URL` for the database connection.

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

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `bun run dev`       | Start server with hot reload             |
| `bun run start`     | Run migrations and start server          |
| `bun run build`     | Build for production                     |
| `bun run lint`      | Run Biome linter                         |
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:migrate`  | Apply pending migrations               |
| `bun run db:push`     | Push schema directly (dev only)        |
| `bun run db:studio`   | Open Drizzle Studio UI                 |
