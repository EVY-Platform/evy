import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";
import RadioButton from "@/app/rows/design-system/radio-button";

export default function InlinePickerRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);
	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Inline picker row title"}
			</p>
			<div className="p-2 flex gap-2">
				<RadioButton label="1 min" selected={false} />
				<RadioButton label="2 mins" selected={true} />
				<RadioButton label="5 mins" selected={false} />
			</div>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Inline picker row title",
	},
];
