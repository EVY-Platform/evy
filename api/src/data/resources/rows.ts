import type { DATA_EVY_Row } from "evy-types";
import { row } from "evy-types/db/schema.generated";
import { validateDataEvyRow } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

const rowResource = makeCoreResource<DATA_EVY_Row>({
	table: row,
	validate: validateDataEvyRow,
	toUpdateSet: (v) => ({
		name: v.name,
		type: v.type,
		visible: v.visible,
		data: v.data,
	}),
});

export const listRowRows = rowResource.list;
export const createRowResource = rowResource.create;
export const updateRowResource = rowResource.update;
export const deleteRowResource = rowResource.remove;
