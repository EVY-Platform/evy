import { afterEach, beforeEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	resetImageStorageDirsForTest,
	setImageStorageDirsForTest,
} from "../imageFiles";

type ImageStorageTestDirs = {
	imagesDir: string;
	uploadTmpDir: string;
};

export function useImageStorageDirsForTest(
	name: string,
): () => ImageStorageTestDirs {
	let dirs: ImageStorageTestDirs;

	beforeEach(async () => {
		dirs = {
			imagesDir: join(
				tmpdir(),
				`evy-${name}-images-test-${crypto.randomUUID()}`,
			),
			uploadTmpDir: join(
				tmpdir(),
				`evy-${name}-uploads-test-${crypto.randomUUID()}`,
			),
		};
		await mkdir(dirs.imagesDir, { recursive: true });
		await mkdir(dirs.uploadTmpDir, { recursive: true });
		setImageStorageDirsForTest(dirs);
	});

	afterEach(async () => {
		resetImageStorageDirsForTest();
		await rm(dirs.imagesDir, { recursive: true, force: true });
		await rm(dirs.uploadTmpDir, { recursive: true, force: true });
	});

	return () => dirs;
}
