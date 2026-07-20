import type { DATA_EVY_Page } from "evy-types";
import { page } from "evy-types/db/schema.generated";
import { validateDataEvyPage } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

function normalizePageRow(rowData: typeof page.$inferSelect): DATA_EVY_Page {
	return validateDataEvyPage({
		id: rowData.id,
		name: rowData.name,
		...(rowData.title === null ? {} : { title: rowData.title }),
		rowIds: rowData.rowIds,
		...(rowData.footerRowId === null
			? {}
			: { footerRowId: rowData.footerRowId }),
		createdAt: rowData.createdAt,
		updatedAt: rowData.updatedAt,
	});
}

const pageResource = makeCoreResource<DATA_EVY_Page>({
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

export const listPageRows = pageResource.list;
export const createPageResource = pageResource.create;
export const updatePageResource = pageResource.update;
export const deletePageResource = pageResource.remove;
