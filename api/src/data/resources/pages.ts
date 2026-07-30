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
		row_ids: v.row_ids,
		footer_row_id: v.footer_row_id,
		visibility: v.visibility,
	}),
});
