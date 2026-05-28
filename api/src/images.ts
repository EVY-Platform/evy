import { deleteImageMetadata, getImageMetadata } from "./data";
import { deleteImageBinary, readImageBinary } from "./imageFiles";
import {
	validateGetImageParams,
	validateDeleteImageParams,
} from "evy-types/validators";

export interface GetImageResponse {
	id: string;
	type: string;
	createdAt: string;
	dataBase64: string;
}

export async function getImage(params: unknown): Promise<GetImageResponse> {
	const validated = validateGetImageParams(params);

	const metadata = await getImageMetadata(validated.id);
	let fileData: Buffer;
	try {
		fileData = await readImageBinary({
			id: metadata.id,
			type: metadata.type,
		});
	} catch {
		throw new Error(`Image binary not found for id: ${validated.id}`);
	}

	return {
		id: metadata.id,
		type: metadata.type,
		createdAt: metadata.createdAt,
		dataBase64: fileData.toString("base64"),
	};
}

export async function deleteImage(params: unknown): Promise<{ ok: true }> {
	const validated = validateDeleteImageParams(params);

	const metadata = await getImageMetadata(validated.id);
	try {
		await deleteImageBinary({ id: metadata.id, type: metadata.type });
	} catch {
		// Binary already missing — still clean up metadata to avoid orphan.
	}

	await deleteImageMetadata(metadata.id);
	return { ok: true };
}
