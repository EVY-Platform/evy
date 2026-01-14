import { watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const PORT = Number.parseInt(process.env.WEB_PORT || "3000", 10);
const API_URL = process.env.API_URL || "ws://localhost:8000";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

async function runSetup() {
	const proc = Bun.spawn(["bun", "run", "setup"], {
		cwd: PROJECT_ROOT,
		stdout: "pipe",
		stderr: "pipe",
	});
	await proc.exited;
	return proc.exitCode === 0;
}

async function runBuild() {
	const proc = Bun.spawn(
		[
			"bun",
			"build",
			"--target=browser",
			"--outdir=dist",
			"--entry-naming=[dir]/bundle.js",
			`--define:__API_URL__='${API_URL}'`,
			"app/main.tsx",
		],
		{
			cwd: PROJECT_ROOT,
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(stderr);
	}
	return true;
}

async function rebuild() {
	try {
		await runSetup();
		await runBuild();
		console.log("✅ Build complete");
	} catch (error) {
		console.error("❌ Build error:", error);
	}
}

function watchFiles() {
	const appDir = join(PROJECT_ROOT, "app");
	console.log(`👀 Watching ${appDir} for changes...`);

	watch(appDir, { recursive: true }, async (_eventType, filename) => {
		if (!filename) return;
		console.log(`Change detected: ${filename}`);
		await rebuild();
	});
}

function startServer() {
	const server = Bun.serve({
		port: PORT,
		async fetch(req) {
			const url = new URL(req.url);
			let pathname = url.pathname;

			// Default to index.html for root
			if (pathname === "/") {
				pathname = "/index.html";
			}

			const filePath = join(DIST_DIR, pathname);

			try {
				const file = Bun.file(filePath);
				if (await file.exists()) {
					return new Response(file, {
						headers: {
							"Access-Control-Allow-Origin": "*",
						},
					});
				}
			} catch {
				// File doesn't exist, fall through to 404
			}

			// Try index.html for SPA routing
			const indexFile = Bun.file(join(DIST_DIR, "index.html"));
			if (await indexFile.exists()) {
				return new Response(indexFile, {
					headers: {
						"Access-Control-Allow-Origin": "*",
					},
				});
			}

			return new Response("Not Found", { status: 404 });
		},
	});

	console.log(`🚀 Server running at http://localhost:${server.port}`);
}

// Main entry point
if (IS_PRODUCTION) {
	// In production, just serve the pre-built files
	startServer();
} else {
	// In development, rebuild and watch for changes
	await rebuild();
	watchFiles();
	startServer();
}
