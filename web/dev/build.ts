import { join } from "node:path";

const PROJECT_ROOT = `${import.meta.dir}/..`;
const DIST_DIR = join(PROJECT_ROOT, "dist");
const apiUrl = process.env.API_URL;

if (!apiUrl) {
	throw new Error("API_URL environment variable is not set");
}

async function runSetup() {
	const proc = Bun.spawn(["bun", "run", "setup"], {
		cwd: PROJECT_ROOT,
		stdout: "pipe",
		stderr: "pipe",
	});
	await proc.exited;
	if (proc.exitCode !== 0) {
		throw new Error("Setup step failed");
	}
}

async function runBuild() {
	const result = await Bun.build({
		entrypoints: [join(PROJECT_ROOT, "app/main.tsx")],
		outdir: DIST_DIR,
		target: "browser",
		naming: "[dir]/bundle.js",
		define: {
			__API_URL__: JSON.stringify(apiUrl),
		},
	});

	if (!result.success) {
		throw new Error(`Build failed: ${JSON.stringify(result.logs)}`);
	}
}

await runSetup();
await runBuild();
