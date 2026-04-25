# AGENTS instructions for EVY

Always read `package.json` files and the root `README.md` for setup, development, testing, and CI instructions.
Always use `bun` to run commands or install dependencies.

## Code conventions

- KISS: Keep It Simple Stupid. Complexity is the enemy of maintainability.
- Use explicit variable names (even if lengthy).
- Use Biome to auto-format code.
- Avoid typecasting unless absolutely impossible to avoid.

## Development

For web or api, make sure you run `bun run build`, `bun run lint` and `bun run test` anytime you make major changes and fix issues that arise.
For iOS, make sure you build with Xcode targeting iPhone Air iOS 26.2 and fix any errors.
Ensure you run `./run-e2e.sh --skip-ios` from root to run the e2e tests (see README.md for `--no-docker` option).
If you need to run iOS tests, keep services running and just run the iOS tests separately rather than re-running the whole e2e suite.
NEVER skip tests of any kind

## Pull requests

Pull request names should be prefixed with "feat|fix|chore: "
Pull request descriptions should include the summary of the task, the major changes made, the tests ran, and any risks or suggestions for later
