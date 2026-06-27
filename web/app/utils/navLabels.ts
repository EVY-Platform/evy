import type { DATA_EVY_Page } from "evy-types";
import type { Row } from "../types/row";
import { splitCamelCaseToWords } from "./labelFormatting";

export function breadcrumbLabelForRow(row: Row): string {
	const title = row.config.title;
	if (typeof title === "string" && title.trim() !== "") {
		return title;
	}
	return splitCamelCaseToWords(row.config.type);
}

export function breadcrumbLabelForPage(
	page: DATA_EVY_Page,
	pagesInFlow: DATA_EVY_Page[],
): string {
	const trimmedTitle = page.title?.trim() ?? "";
	if (trimmedTitle !== "") {
		return trimmedTitle;
	}
	const index = pagesInFlow.findIndex((p) => p.id === page.id);
	const position = index >= 0 ? index + 1 : 1;
	return `Page ${position}`;
}
