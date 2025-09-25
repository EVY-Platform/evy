# EVY Web

A React-based app builder built with Deno and served using std/http/file-server.

## Getting Started

### Prerequisites

-   [Deno](https://deno.land/) installed on your system

### Running the App

#### Development Mode

```bash
deno task dev
```

This will build the application and start the server.

#### Production Mode

```bash
deno task build
deno task start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### In Docker

```bash
docker compose up -d
```

## Testing

This project includes comprehensive end-to-end tests using Playwright.

### Running Tests

```bash
deno task test
deno task test:ui
deno task test:debug
```

## License

Apache 2.0, see [LICENSE](LICENSE) for more details.
