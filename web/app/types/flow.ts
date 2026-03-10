/**
 * Flow and page types. All shapes come from evy-types (schema-generated).
 * SDUI_Flow/SDUI_Page use UI Row (with ReactNode) on top of evy-types serial shapes.
 */
import type { Row } from "./row";
import type {
	SDUI_Flow as EvySDUI_Flow,
	SDUI_Page as EvySDUI_Page,
} from "evy-types";

/** Client page: same shape as evy-types SDUI_Page but rows/footer use UI Row */
export type SDUI_Page = Omit<EvySDUI_Page, "rows" | "footer"> & {
	rows: Row[];
	footer?: Row;
};

/** Client flow: same shape as evy-types SDUI_Flow but pages use client SDUI_Page */
export type SDUI_Flow = Omit<EvySDUI_Flow, "pages"> & {
	pages: SDUI_Page[];
};
