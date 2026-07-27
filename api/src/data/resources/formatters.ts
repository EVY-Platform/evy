import type { DATA_EVY_Formatter } from "evy-types";
import { formatter } from "evy-types/db/schema.generated";
import { validateDataEvyFormatter } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

export const formattersResource = makeCoreResource<DATA_EVY_Formatter>({
	table: formatter,
	validate: validateDataEvyFormatter,
	visibility: false,
	toUpdateSet: (v) => ({
		name: v.name,
		formatting_config: v.formatting_config,
		formatting: v.formatting,
	}),
});
