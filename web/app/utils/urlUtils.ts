import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { findRowIdPath } from "./flatGraph";
import { pageRootIds } from "./rowTraversal";

export function parseUrlPath(): {
	flowId?: string;
	pageId?: string;
	rowPathSegments: string[];
} {
	const parts = window.location.pathname.split("/").filter(Boolean);
	return {
		flowId: parts[0] || undefined,
		pageId: parts[1] || undefined,
		rowPathSegments: parts.slice(2).map((segment) => {
			try {
				return decodeURIComponent(segment);
			} catch {
				return segment;
			}
		}),
	};
}

/** Synthetic search preview row ids must never appear in real URLs. */
// exported for tests
export function isNonRoutablePreviewRowId(rowId: string): boolean {
	return (
		rowId.includes(":search-preview:") ||
		rowId.endsWith(":search-preview-default")
	);
}

function isDirectChildRow(
	rowsById: Record<string, DATA_EVY_Row>,
	parentId: string,
	childId: string,
): boolean {
	const row = rowsById[parentId];
	if (!row) return false;
	return (
		row.data.child_row_id === childId ||
		row.data.sheet_row_id === childId ||
		(Array.isArray(row.data.children_row_ids) &&
			(row.data.children_row_ids as string[]).includes(childId))
	);
}

/**
 * Validates a `/flow/page/root/.../leaf` chain against the flat page maps.
 * Truncates at the first invalid segment (stale id or broken parent/child link).
 */
export function validateRowPathSegmentsForPage(
	pageId: string,
	rawSegments: string[],
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
): { rootRowId: string; configStack: string[] } | null {
	const segments = rawSegments.filter(
		(id) => id.length > 0 && !isNonRoutablePreviewRowId(id),
	);
	if (segments.length === 0) return null;

	const page = pagesById[pageId];
	if (!page) return null;

	const firstId = segments[0];
	if (!findRowIdPath(rowsById, pageRootIds(page), firstId)) return null;

	const validated: string[] = [firstId];
	for (let i = 1; i < segments.length; i++) {
		const nextId = segments[i];
		if (
			!isDirectChildRow(rowsById, validated[validated.length - 1], nextId)
		)
			break;
		validated.push(nextId);
	}

	const rootRowId = validated[0];
	const configStack = validated.slice(1);
	return { rootRowId, configStack };
}

export function buildUrlPath(
	flowId?: string,
	pageId?: string,
	rowPathSegments?: string[],
): string {
	const rowParts =
		rowPathSegments?.filter(
			(id) => id.length > 0 && !isNonRoutablePreviewRowId(id),
		) ?? [];

	if (!flowId) return "/";
	if (!pageId) return `/${flowId}`;
	const base = `/${flowId}/${pageId}`;
	if (rowParts.length === 0) return base;
	const encoded = rowParts.map((segment) => encodeURIComponent(segment));
	return `${base}/${encoded.join("/")}`;
}

export function resolveUrlIds(
	urlFlowId: string | undefined,
	urlPageId: string | undefined,
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
): { flowId: string | undefined; pageId: string | undefined } {
	const flowIds = Object.keys(flowsById);
	const defaultFlowId = flowIds[0];

	if (!urlFlowId) {
		return { flowId: defaultFlowId, pageId: undefined };
	}

	const flow = flowsById[urlFlowId];
	if (!flow) {
		const firstPageId = flowsById[defaultFlowId ?? ""]?.pageIds[0];
		return {
			flowId: defaultFlowId,
			pageId:
				firstPageId && pagesById[firstPageId] ? firstPageId : undefined,
		};
	}

	if (!urlPageId) {
		return { flowId: urlFlowId, pageId: undefined };
	}

	if (flow.pageIds.includes(urlPageId)) {
		return { flowId: urlFlowId, pageId: urlPageId };
	}

	return { flowId: urlFlowId, pageId: flow.pageIds[0] };
}
