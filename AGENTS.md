# AGENTS instructions for EVY

Always read `package.json` files and the root `README.md` for setup, development, testing, and CI instructions.
Always use `bun` to run commands or install dependencies.

## Code conventions

- KISS: Keep It Simple Stupid. Complexity is the enemy of maintainability.
- Use explicit variable names (even if lengthy).
- Use Biome to auto-format code any time changes are saved
- Avoid typecasting unless absolutely impossible to avoid.
- Serialized names (Postgres, JSON Schema, RPC, SDUI, enum values) are snake_case; language type names are derived — see `docs/evy/data.md` § Naming.

## Development

For web or api, make sure you run `bun run build`, `bun run lint`, and `bun run test:unit` anytime you make major changes and fix issues that arise. For web, also run `bun run typecheck` and `bun run test:integration` — the build does not typecheck, so `typecheck` is the only thing that reads tsconfig's `strict`.
For iOS, make sure you build with Xcode targeting iPhone 17 iOS 26.5 and fix any errors.
Ensure you run `./run-e2e.sh --skip-ios` from root to run the e2e tests.
If you need to run iOS tests, keep services running and just run the iOS tests separately rather than re-running the whole e2e suite.
NEVER skip tests of any kind

After completing any set of changes, always run `bun run format` from the repo root before finishing.

## Pull requests

Pull request names should be prefixed with "[FEAT|BUG|REFACTOR]"
Pull request descriptions should include the summary of the task, the major changes made, the tests ran, and any risks or suggestions for later
