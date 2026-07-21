/**
 * On-disk binary storage for the files resource: directory config,
 * atomic tmp-then-rename writes, and path sanitization.
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let filesDir = resolve(join(__dirname, "..", "..", "public", "files"));
let uploadTmpDir = resolve(join(__dirname, "..", "..", "public", "uploads"));

const NODE_ENOENT = "ENOENT" as const;

// Test hooks

export function setFileStorageDirsForTest(params: {
	filesDir: string;
	uploadTmpDir: string;
}): void {
	filesDir = params.filesDir;
	uploadTmpDir = params.uploadTmpDir;
}

export function resetFileStorageDirsForTest(): void {
	filesDir = resolve(join(__dirname, "..", "..", "public", "files"));
	uploadTmpDir = resolve(join(__dirname, "..", "..", "public", "uploads"));
}

// Binary storage

// exported for tests
export async function writeFileBinary(params: {
	id: string;
	bytes: Buffer;
}): Promise<void> {
	await mkdir(filesDir, { recursive: true });
	await mkdir(uploadTmpDir, { recursive: true });

	const finalPath = filePath(params.id);
	const tmpPath = join(uploadTmpDir, `${sanitizeFileId(params.id)}.tmp`);

	try {
		await writeFile(tmpPath, params.bytes);
		await rename(tmpPath, finalPath);
	} catch (err) {
		await deletePathIfExists(finalPath);
		await deletePathIfExists(tmpPath);
		throw err;
	}
}

export async function readFileBinary(id: string): Promise<Buffer> {
	return readFile(filePath(id));
}

export async function deleteFileBinaryIfExists(id: string): Promise<void> {
	await deletePathIfExists(filePath(id));
}

// Local helpers

function filePath(id: string): string {
	return resolve(join(filesDir, sanitizeFileId(id)));
}

function sanitizeFileId(id: string): string {
	return id.replace(/[^a-zA-Z0-9-]/g, "");
}

function hasNodeErrorCode(err: unknown, code: string): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === code
	);
}

async function deletePathIfExists(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch (err) {
		if (!hasNodeErrorCode(err, NODE_ENOENT)) {
			throw err;
		}
	}
}
