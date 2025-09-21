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

## Architecture

-   **Build System**: Uses Deno's built-in capabilities to create a JavaScript bundle
-   **Server**: Uses Deno's std/http/file-server to serve static files
-   **Frontend**: React 19 with Tailwind CSS loaded from CDN
-   **No Node.js**: Completely runs on Deno runtime

## License

Apache 2.0, see [LICENSE](LICENSE) for more details.
