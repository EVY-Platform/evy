import { createElement } from "react";

import type { Row, RowConfig } from "../../types/row";
import { SEARCH_DEFAULT_RESULT_CONTENT } from "../../utils/searchRowDefaults";
import { defineRow } from "../defineRow";
import InlineIcon from "../design-system/InlineIcon";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";
import InfoRow from "../view/InfoRow";
import { SearchPreviewResults } from "./searchPreview";

const SEARCH_RESULT_TEMPLATE_ROW_ID = "00000000-0000-4000-8000-000000000001";

const defaultSearchResultTemplateRow: Row = {
	id: SEARCH_RESULT_TEMPLATE_ROW_ID,
	row: createElement(InfoRow, {
		key: SEARCH_RESULT_TEMPLATE_ROW_ID,
		rowId: SEARCH_RESULT_TEMPLATE_ROW_ID,
	}),
	config: {
		type: "Info",
		source: "",
		destination: "",
		actions: [],
		view: {
			content: {
				...SEARCH_DEFAULT_RESULT_CONTENT,
			},
		},
	},
};

export default defineRow("SearchRow", {
	config: {
		type: "Search",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Search row title",
				placeholder: "placeholder",
				child: defaultSearchResultTemplateRow,
			},
		},
		destination: "{address}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-relative">
				<InlineIcon icon="::search::" alt="Search" />
				<Input
					value={row.config.source}
					placeholder={row.config.view.content.placeholder ?? ""}
				/>
			</div>
			<SearchPreviewResults
				templateRow={row.config.view.content.child}
				parentRowId={row.id}
			/>
		</RowLayout>
	),
});
