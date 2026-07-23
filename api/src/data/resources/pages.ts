import type { DATA_EVY_Page } from "evy-types";
import { page } from "evy-types/db/schema.generated";
import { validateDataEvyPage } from "evy-types/validators";
import { makeCoreResource, omitNulls } from "./coreResource";

function normalizePageRow(rowData: typeof page.$inferSelect): DATA_EVY_Page {
	return validateDataEvyPage(omitNulls(rowData));
}

export const pagesResource = makeCoreResource<DATA_EVY_Page>({
	table: page,
	validate: validateDataEvyPage,
	toUpdateSet: (v) => ({
		name: v.name,
		title: v.title,
		rowIds: v.rowIds,
		footerRowId: v.footerRowId,
	}),
	normalize: normalizePageRow,
});
