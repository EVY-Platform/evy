/** RPC-facing facade over the shared upload-session store. */
import { deleteUploadSession } from "../shared/uploadSessions";

export {
	clearUploadsForTest,
	handleUploadChunk,
	parseUploadChunkFrame,
	type UploadSession,
} from "../shared/uploadSessions";

export async function cancelUpload(params: unknown): Promise<{ ok: true }> {
	validateCancelUploadParams(params);
	deleteUploadSession(params.uploadId);
	return { ok: true };
}

function validateCancelUploadParams(
	value: unknown,
): asserts value is { uploadId: string } {
	if (typeof value !== "object" || value === null) {
		throw new Error("CancelUploadRequest validation failed");
	}
	const params = value as Record<string, unknown>;
	if (typeof params.uploadId !== "string" || params.uploadId.length < 1) {
		throw new Error("CancelUploadRequest validation failed");
	}
}
