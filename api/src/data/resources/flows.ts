import type { DATA_EVY_Flow } from "evy-types";
import { flow } from "evy-types/db/schema.generated";
import { validateDataEvyFlow } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const flowsResource = makeCoreResource<DATA_EVY_Flow>({
	table: flow,
	validate: validateDataEvyFlow,
	toUpdateSet: (v) => ({ name: v.name, pageIds: v.pageIds }),
});
