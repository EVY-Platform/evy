# EVY Web

A React-based app builder built with Bun.

## Getting Started

### Prerequisites

-   [Bun](https://bun.sh/) installed on your system

### Installation

```bash
bun install
```

### Running the App

#### Development Mode

```bash
bun run dev
```

This will build the application and start the dev server with hot reloading.

#### Production Mode

```bash
bun run build
bun run prod
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### In Docker

```bash
docker compose up -d
```

## Testing

This project includes comprehensive end-to-end tests using Playwright.

### Setup

```bash
bun run test:setup
```

### Running Tests

```bash
bun run test
```

To run the tests with UI or debug mode:

```bash
bun run test:ui
bun run test:debug
```

## License

Apache 2.0, see [LICENSE](LICENSE) for more details.
