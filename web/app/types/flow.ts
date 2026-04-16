/**
 * Flow and page types. All shapes come from evy-types (schema-generated).
 * UI_Flow/UI_Page use UI Row (with ReactNode) on top of evy-types serial shapes.
 */
import type { Row } from "./row";
import type {
	UI_Flow as SerialUI_Flow,
	UI_Page as SerialUI_Page,
} from "evy-types";

/** Client page: same shape as evy-types UI_Page but rows/footer use UI Row */
export type UI_Page = Omit<SerialUI_Page, "rows" | "footer"> & {
	rows: Row[];
	footer?: Row;
};

/** Client flow: same shape as evy-types UI_Flow but pages use client UI_Page */
export type UI_Flow = Omit<SerialUI_Flow, "pages"> & {
	pages: UI_Page[];
};
