import type { DATA_EVY_Page } from "evy-types";
import { page } from "evy-types/db/schema.generated";
import { validateDataEvyPage } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const pagesResource = makeCoreResource<DATA_EVY_Page>({
	table: page,
	validate: validateDataEvyPage,
	toUpdateSet: (v) => ({
		name: v.name,
		title: v.title,
		rowIds: v.rowIds,
		footerRowId: v.footerRowId,
		visibility: v.visibility,
	}),
});
