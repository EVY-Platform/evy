import type { UI_Page } from "../types/flow";
import type { Row } from "../types/row";
import { findFlowById } from "./flowHelpers";
import { findRowInSinglePage, getRowsRecursive } from "./rowTree";

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
export function isNonRoutablePreviewRowId(rowId: string): boolean {
	return (
		rowId.includes(":search-preview:") ||
		rowId.endsWith(":search-preview-default")
	);
}

function isDirectChildRow(parent: Row, childId: string): boolean {
	const child = parent.config.view.content.child;
	if (child?.id === childId) return true;
	return (
		parent.config.view.content.children?.some((c) => c.id === childId) ?? false
	);
}

/**
 * Validates a `/flow/page/root/.../leaf` chain against the page tree.
 * Truncates at the first invalid segment (stale id or broken parent/child link).
 */
export function validateRowPathSegmentsForPage(
	page: UI_Page,
	rawSegments: string[],
): { rootRowId: string; configStack: string[] } | null {
	const segments = rawSegments.filter(
		(id) => id.length > 0 && !isNonRoutablePreviewRowId(id),
	);
	if (segments.length === 0) return null;

	const firstId = segments[0];
	if (!findRowInSinglePage(page, firstId)) return null;

	const validated: string[] = [firstId];
	for (let i = 1; i < segments.length; i++) {
		const parentId = validated[validated.length - 1];
		const parentRow = findRowInSinglePage(page, parentId);
		const nextId = segments[i];
		if (!parentRow || !isDirectChildRow(parentRow, nextId)) break;
		if (!findRowInSinglePage(page, nextId)) break;
		validated.push(nextId);
	}

	const rootRowId = validated[0];
	const configStack = validated.slice(1);
	return { rootRowId, configStack };
}

/**
 * Matches `PUSH_CONFIG_STACK` sheet focus rules for a full root + stack chain.
 */
export function deriveSheetAndFocusFromRowChain(
	pages: UI_Page[],
	activeRowId: string,
	configStack: string[],
): { focusMode: boolean; secondarySheetRowId?: string } {
	const chain = [activeRowId, ...configStack];
	let focusMode = false;
	let secondarySheetRowId: string | undefined;

	for (let i = 0; i < chain.length - 1; i++) {
		const parentRowId = chain[i];
		const childId = chain[i + 1];
		let parentRow: Row | undefined;
		for (const p of pages) {
			parentRow = findRowInSinglePage(p, parentRowId);
			if (parentRow) break;
		}
		if (!parentRow) break;

		const isSheetNested =
			parentRow.config.type === "SheetContainer" &&
			(parentRow.config.view.content.child?.id === childId ||
				parentRow.config.view.content.children?.some((c) => c.id === childId));

		if (isSheetNested) {
			focusMode = true;
			secondarySheetRowId = parentRow.id;
		}
	}

	return { focusMode, secondarySheetRowId };
}

/** Real canvas page id for URL (never `secondary:*`). */
export function resolveCanonicalPageIdForUrl(
	flows: { id: string; pages: UI_Page[] }[],
	activeFlowId: string | undefined,
	activePageId: string | undefined,
): string | undefined {
	if (!activeFlowId || !activePageId) return activePageId;
	if (!activePageId.startsWith("secondary:")) return activePageId;

	const hostRowId = activePageId.slice("secondary:".length);
	const flow = findFlowById(flows, activeFlowId);
	if (!flow) return undefined;

	const page = flow.pages.find((p) =>
		p.rows.some((r) => getRowsRecursive(r).some((row) => row.id === hostRowId)),
	);
	return page?.id;
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
	flows: { id: string; pages: { id: string }[] }[],
): { flowId: string | undefined; pageId: string | undefined } {
	const defaultFlowId = flows[0]?.id;

	if (!urlFlowId) {
		return { flowId: defaultFlowId, pageId: undefined };
	}

	const flow = findFlowById(flows, urlFlowId);
	if (!flow) {
		alert(`Flow not found: "${urlFlowId}". Showing the first available flow.`);
		return { flowId: defaultFlowId, pageId: flows[0]?.pages[0]?.id };
	}

	if (!urlPageId) {
		return { flowId: urlFlowId, pageId: undefined };
	}

	const pageExists = flow.pages.some((p) => p.id === urlPageId);
	if (!pageExists) {
		alert(`Page not found: "${urlPageId}". Showing the first page.`);
		return { flowId: urlFlowId, pageId: flow.pages[0]?.id };
	}

	return { flowId: urlFlowId, pageId: urlPageId };
}
