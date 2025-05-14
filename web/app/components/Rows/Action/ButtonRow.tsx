import React, { useContext } from "react";

import Button from "@/app/design-system/button.tsx";
import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "../../row.tsx";

export default function ButtonRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2 flex justify-center">
			<Button
				label={
					row?.config.find((c) => c.id === "text")?.value ??
					"Button row text"
				}
			/>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "text",
		type: "text",
		value: "Button row text",
	},
];
