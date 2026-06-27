import { createElement } from "react";

import type { Row, RowConfig } from "../../types/row";
import { SEARCH_DEFAULT_RESULT_CONTENT } from "../../utils/searchRowDefaults";
import { defineRow } from "../defineRow";
import InlineIcon from "../design-system/InlineIcon";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";
import TextRow from "../view/TextRow";

const SEARCH_RESULT_TEMPLATE_ROW_ID = "09f07052-c27c-4116-a508-a2bcb074c827";

const defaultSearchResultTemplateRow: Row = {
	id: SEARCH_RESULT_TEMPLATE_ROW_ID,
	row: createElement(TextRow, {
		key: SEARCH_RESULT_TEMPLATE_ROW_ID,
		rowId: SEARCH_RESULT_TEMPLATE_ROW_ID,
	}),
	config: {
		type: "Text",
		source: "",
		visible: "true",
		destination: "",
		actions: [],
		...SEARCH_DEFAULT_RESULT_CONTENT,
	},
};

export default defineRow("SearchRow", {
	config: {
		type: "Search",
		actions: [],
		source: "",
		visible: "true",
		title: "Search row title",
		placeholder: "placeholder",
		value: "",
		child: defaultSearchResultTemplateRow,
		destination: "{address}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-relative">
				<InlineIcon icon="::search::" alt="Search" />
				<Input
					value={row.config.source}
					placeholder={row.config.placeholder}
				/>
			</div>
		</RowLayout>
	),
});
