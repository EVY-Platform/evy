# EVY

One platform to rule them all - Plaform to enable Features as a Service

-   [docs](/docs/README.md)
-   [api](/api/README.md)
-   [web](/web/README.md)
-   [iOS](/ios/README.md)
-   [Android](/android/README.md)

## Setup

1. Install [Bun](https://bun.sh/)
2. Install [Docker](https://www.docker.com/)

## Running Services

### Development (with Docker Compose)

Run all services together (builds images locally):

```bash
docker compose up --build
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
docker run -p 8000:8000 -e DB_URL="your-database-url" evy-api
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
