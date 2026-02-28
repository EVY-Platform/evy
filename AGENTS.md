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
Also make sure you can run the app with docker-compose up --build from both the root and the api and web directories.

For iOS, make sure you build with xcode iPhone Air iOS 26.2 and fix any errors
If you need to run iOS tests, try to avoid re-running the whole e2e suite to restart docker files, keep them running and just run the iOS tests.
