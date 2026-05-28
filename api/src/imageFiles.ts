import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let imagesDir = resolve(join(__dirname, "..", "public", "images"));
let uploadTmpDir = resolve(join(__dirname, "..", "public", "uploads"));

const IMAGE_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
};

const MAGIC_BYTES: Record<string, number[]> = {
	"image/jpeg": [0xff, 0xd8, 0xff],
	"image/png": [0x89, 0x50, 0x4e, 0x47],
};

export function assertSupportedImageType(type: string): void {
	if (!IMAGE_EXTENSIONS[type]) {
		throw new Error(`Unsupported image type: ${type}`);
	}
}

export function validateImageBytes(buffer: Buffer, type: string): void {
	assertSupportedImageType(type);
	const expected = MAGIC_BYTES[type];
	for (let i = 0; i < expected.length; i++) {
		if (buffer[i] !== expected[i]) {
			throw new Error(`Invalid magic bytes for image type ${type}`);
		}
	}
}

export async function writeImageBinary(params: {
	id: string;
	type: string;
	bytes: Buffer;
}): Promise<void> {
	validateImageBytes(params.bytes, params.type);
	await mkdir(imagesDir, { recursive: true });
	await mkdir(uploadTmpDir, { recursive: true });

	const finalPath = imagePath(params.id, params.type);
	const tmpPath = join(uploadTmpDir, `${sanitizeImageId(params.id)}.tmp`);

	try {
		await writeFile(tmpPath, params.bytes);
		await rename(tmpPath, finalPath);
	} catch (err) {
		await deletePathIfExists(finalPath);
		await deletePathIfExists(tmpPath);
		throw err;
	}
}

export async function readImageBinary(params: {
	id: string;
	type: string;
}): Promise<Buffer> {
	return readFile(imagePath(params.id, params.type));
}

export async function deleteImageBinary(params: {
	id: string;
	type: string;
}): Promise<void> {
	await unlink(imagePath(params.id, params.type));
}

export async function deleteImageBinaryIfExists(params: {
	id: string;
	type: string;
}): Promise<void> {
	await deletePathIfExists(imagePath(params.id, params.type));
}

function imagePath(id: string, type: string): string {
	const ext = IMAGE_EXTENSIONS[type];
	if (!ext) {
		throw new Error(`Unsupported image type: ${type}`);
	}
	return resolve(join(imagesDir, `${sanitizeImageId(id)}.${ext}`));
}

function sanitizeImageId(id: string): string {
	return id.replace(/[^a-zA-Z0-9-]/g, "");
}

async function deletePathIfExists(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch {
		// ignore
	}
}

export function setImageStorageDirsForTest(params: {
	imagesDir: string;
	uploadTmpDir: string;
}): void {
	imagesDir = params.imagesDir;
	uploadTmpDir = params.uploadTmpDir;
}

export function resetImageStorageDirsForTest(): void {
	imagesDir = resolve(join(__dirname, "..", "public", "images"));
	uploadTmpDir = resolve(join(__dirname, "..", "public", "uploads"));
}
