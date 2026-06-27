import type { DATA_EVY_Flow } from "evy-types";
import { validateDataEvyFlow } from "evy-types/validators";
import { flow } from "../../../../types/generated/ts/db/schema.generated";
import { makeCoreResource } from "./coreResource";

const flowResource = makeCoreResource<DATA_EVY_Flow>({
	table: flow,
	validate: validateDataEvyFlow,
	toUpdateSet: (v) => ({ name: v.name, pageIds: v.pageIds }),
});

export const listFlowRows = flowResource.list;
export const createFlowResource = flowResource.create;
export const updateFlowResource = flowResource.update;
export const deleteFlowResource = flowResource.remove;
