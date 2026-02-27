import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED = join(ROOT, "types", "generated");

function run(
	cmd: string,
	args: string[],
): { ok: boolean; stdout: string; stderr: string } {
	const r = spawnSync(cmd, args, { encoding: "utf-8", cwd: ROOT });
	return {
		ok: r.status === 0,
		stdout: r.stdout || "",
		stderr: r.stderr || "",
	};
}

const diff = run("git", ["diff", "--exit-code", GENERATED]);
if (!diff.ok) {
	console.error(
		"Generated types are out of date. Run `bun run types:generate` and commit the changes.",
	);
	process.exit(1);
}

console.log("Generated types are up to date.");
