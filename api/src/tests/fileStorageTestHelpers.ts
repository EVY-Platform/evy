import { afterEach, beforeEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	resetFileStorageDirsForTest,
	setFileStorageDirsForTest,
} from "../data/resources/fileStorage";

type FileStorageTestDirs = {
	filesDir: string;
	uploadTmpDir: string;
};

export function useFileStorageDirsForTest(
	name: string,
): () => FileStorageTestDirs {
	let dirs: FileStorageTestDirs;

	beforeEach(async () => {
		dirs = {
			filesDir: join(
				tmpdir(),
				`evy-${name}-files-test-${crypto.randomUUID()}`,
			),
			uploadTmpDir: join(
				tmpdir(),
				`evy-${name}-uploads-test-${crypto.randomUUID()}`,
			),
		};
		await mkdir(dirs.filesDir, { recursive: true });
		await mkdir(dirs.uploadTmpDir, { recursive: true });
		setFileStorageDirsForTest(dirs);
	});

	afterEach(async () => {
		resetFileStorageDirsForTest();
		await rm(dirs.filesDir, { recursive: true, force: true });
		await rm(dirs.uploadTmpDir, { recursive: true, force: true });
	});

	return () => dirs;
}
