/// <reference types="bun-types" />

import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

type SeedFileBinary = { id: string };

async function runCommand(
	command: string[],
	repoRoot: string,
): Promise<{ ok: boolean; stderr: string }> {
	try {
		const proc = Bun.spawn(command, {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stderr = await new Response(proc.stderr).text();
		await proc.exited;
		return { ok: proc.exitCode === 0, stderr };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, stderr: message };
	}
}

async function isApiContainerRunning(
	repoRoot: string,
	apiDockerService: string,
): Promise<boolean> {
	try {
		const proc = Bun.spawn(
			["docker", "compose", "ps", "-q", apiDockerService],
			{
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;
		return proc.exitCode === 0 && stdout.trim().length > 0;
	} catch {
		return false;
	}
}

export async function copySeedFileBinaries(options: {
	files: SeedFileBinary[];
	repoRoot: string;
	seedFilesPath: string;
	runtimeFilesPath: string;
	apiDockerService: string;
	apiContainerFilesDir: string;
}): Promise<void> {
	const {
		files,
		repoRoot,
		seedFilesPath,
		runtimeFilesPath,
		apiDockerService,
		apiContainerFilesDir,
	} = options;

	if (files.length === 0) {
		return;
	}
	await mkdir(runtimeFilesPath, { recursive: true });
	for (const fileRow of files) {
		const sourcePath = join(seedFilesPath, fileRow.id);
		try {
			await stat(sourcePath);
		} catch {
			throw new Error(
				`Missing seed binary for file "${fileRow.id}". Expected asset at ${sourcePath}.`,
			);
		}
		await copyFile(sourcePath, join(runtimeFilesPath, fileRow.id));
	}

	if (!(await isApiContainerRunning(repoRoot, apiDockerService))) {
		return;
	}
	const mkdirResult = await runCommand(
		[
			"docker",
			"compose",
			"exec",
			"-T",
			apiDockerService,
			"mkdir",
			"-p",
			apiContainerFilesDir,
		],
		repoRoot,
	);
	if (!mkdirResult.ok) {
		throw new Error(
			`Failed to create file storage dir in API container: ${mkdirResult.stderr.trim()}`,
		);
	}
	for (const fileRow of files) {
		const copyResult = await runCommand(
			[
				"docker",
				"compose",
				"cp",
				join(seedFilesPath, fileRow.id),
				`${apiDockerService}:${apiContainerFilesDir}/${fileRow.id}`,
			],
			repoRoot,
		);
		if (!copyResult.ok) {
			throw new Error(
				`Failed to copy seed binary "${fileRow.id}" into API container: ${copyResult.stderr.trim()}`,
			);
		}
	}
}
