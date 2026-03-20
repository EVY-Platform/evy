import type { Row } from "../types/row";
import type { SDUI_Page } from "../types/flow";
import { splitCamelCaseToWords } from "./labelFormatting";

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
