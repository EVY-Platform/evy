import type { GetResponse } from "./generated/ts";

type ResponseMetadata = GetResponse["metadata"];

function responseOrderId(item: unknown): string {
	return item !== null && typeof item === "object" && "id" in item
		? String(item.id)
		: "";
}

export function buildResponseMetadata(items: unknown[]): ResponseMetadata {
	return {
		count: items.length,
		size: Buffer.byteLength(JSON.stringify(items), "utf8"),
		order: items.map(responseOrderId),
	};
}

export function buildCollectionResponseEnvelope<TItem>(items: TItem[]): {
	metadata: ResponseMetadata;
	data: TItem[];
} {
	return { metadata: buildResponseMetadata(items), data: items };
}

export function buildSingleResponseEnvelope<TData>(data: TData): {
	metadata: ResponseMetadata;
	data: TData;
} {
	return { metadata: buildResponseMetadata([data]), data };
}
