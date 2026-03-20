import type { Row } from "../types/row";
import type { SDUI_Page } from "../types/flow";

/**
 * Turns identifiers like `ColumnContainer` or `textRow` into spaced words for display.
 */
export function splitCamelCaseToWords(identifier: string): string {
	return identifier
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.trim();
}

export function breadcrumbLabelForRow(row: Row): string {
	const title = row.config.view.content.title;
	if (typeof title === "string" && title.trim() !== "") {
		return title;
	}
	return splitCamelCaseToWords(row.config.type);
}

export function breadcrumbLabelForPage(
	page: SDUI_Page,
	pagesInFlow: SDUI_Page[],
): string {
	const trimmedTitle = page.title?.trim() ?? "";
	if (trimmedTitle !== "") {
		return trimmedTitle;
	}
	const index = pagesInFlow.findIndex((p) => p.id === page.id);
	const position = index >= 0 ? index + 1 : 1;
	return `Page ${position}`;
}
