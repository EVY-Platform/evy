import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";

const PORT = Deno.env.get("WEB_PORT") || "3000";
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const DIST_DIR = `${PROJECT_ROOT}/dist`;

const setupCmd = new Deno.Command("deno", {
	args: ["task", "setup"],
	cwd: PROJECT_ROOT,
	stdout: "piped",
	stderr: "piped",
});
const buildCmd = new Deno.Command("deno", {
	args: ["task", "build"],
	cwd: PROJECT_ROOT,
	stdout: "piped",
	stderr: "piped",
});

async function rebuild() {
	try {
		await setupCmd.output();
		const result = await buildCmd.output();
		if (!result.success) {
			throw new Error(new TextDecoder().decode(result.stderr));
		}
	} catch (error) {
		console.error("❌ Build error:", error);
	}
}

async function watchFiles() {
	try {
		const watcher = Deno.watchFs([`${PROJECT_ROOT}/app`]);
		for await (const event of watcher) {
			if (event.kind !== "modify" && event.kind !== "create") return;
			console.log(`Change detected: ${event.paths[0].split("/").pop()}`);
			await rebuild();
		}
	} catch (error) {
		console.error("❌ Watch error:", error);
	}
}

function startServer() {
	Deno.serve(
		{ port: PORT },
		async (request) =>
			await serveDir(request, {
				fsRoot: DIST_DIR,
				showDirListing: false,
				enableCors: true,
			})
	);
}

if (import.meta.main) {
	await rebuild();
	watchFiles();
	startServer();
}
