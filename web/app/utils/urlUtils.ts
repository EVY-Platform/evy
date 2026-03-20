import { findFlowById } from "./flowHelpers";

export function parseUrlPath(): { flowId?: string; pageId?: string } {
	const parts = window.location.pathname.split("/").filter(Boolean);
	return {
		flowId: parts[0] || undefined,
		pageId: parts[1] || undefined,
	};
}

export function buildUrlPath(flowId?: string, pageId?: string): string {
	if (!flowId) return "/";
	if (!pageId) return `/${flowId}`;
	return `/${flowId}/${pageId}`;
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
