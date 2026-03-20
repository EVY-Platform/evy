# AGENTS instructions for EVY

Always read package.json
It includes commands that can be run for tests, dev, build, lint and others
Always use `bun` to run commands or install dependencies.

## Code conventions

- KISS: Keep It Simple Stupid. Complexity is the enemy of maintainability.
- Use explicit variable names (even if lengthy).
- Use Biome to auto-format code.
- Avoid typecasting unless absolutely impossible to avoid.

## Development

For web or api, make sure you run `bun run build`, `bun run lint` and `bun run test` anytime you make major changes and fix issues that arise.

### Running E2E tests locally

E2E tests can be run with or without Docker for the API and web services.

**Default (Docker):** Builds and runs postgres, API, and web in Docker containers:

```bash
./run-e2e.sh --skip-ios
```

**Without Docker (`--no-docker`):** Runs API and web directly via Bun (faster, no Docker build). Requires postgres to already be running (e.g. `docker compose up postgres`):

```bash
docker compose up -d postgres
./run-e2e.sh --skip-ios --no-docker
```

The `--no-docker` flag starts API and web as background processes, uses direct health checks, and kills them on cleanup. Postgres must be accessible at the `DB_DOMAIN` and `DB_PORT` from your `.env`.

### iOS

Build with Xcode targeting iPhone Air iOS 26.2 and fix any errors.
If you need to run iOS tests, keep the Docker services running and just run the iOS tests separately rather than re-running the whole e2e suite.

### CI

CI workflows use a custom Docker image (`ghcr.io/evy-platform/evy-ci:playwright-<version>`) with Playwright browsers, system deps, and Bun pre-installed. The image is built from `.github/images/ci/Dockerfile` and pushed via `.github/workflows/push-ci-image.yml`.

When bumping `@playwright/test` in `web/package.json`:
1. Update the `FROM` tag in `.github/images/ci/Dockerfile`
2. Update the image tag in `e2e_tests.yml`, `web_tests.yml`, and `push-ci-image.yml`

NEVER skip tests of any kind
