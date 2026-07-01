import type { DATA_EVY_Page } from "evy-types";
import type { Row } from "../types/row";

export function breadcrumbLabelForRow(row: Row): string {
	return row.config.name ?? "";
}

export function breadcrumbLabelForPage(page: DATA_EVY_Page): string {
	return page.name;
}
