import type { RowConfig } from "../types/row";
import { defineRow } from "./defineRow";
import { RowLayout } from "./design-system/RowLayout";

export const containerDropindicatorId = "placeholder";

/** Re-export for callers that still use EVYRow.getRowsRecursive (e.g. decodeFlow). */
export { getRowsRecursive } from "../utils/rowTree";

export const UnknownRow = defineRow("UnknownRow", {
	config: {
		type: "Unknown",
		actions: [],
		view: {
			content: {
				title: "Unknown row",
			},
		},
	} satisfies RowConfig,
	render: (row) => <RowLayout title={row.config.view.content.title} />,
});
