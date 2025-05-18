import { useCallback, useContext, useMemo } from "react";

import { AppContext } from "../registry";

export function ConfigurationPanel() {
	const { pages, activeRow, dispatchPages } = useContext(AppContext);
	if (!activeRow) return undefined;

	const row = useMemo(
		() =>
			pages
				.flatMap((page) => page.rowsData)
				.find((r) => r.rowId === activeRow.rowId),
		[pages, activeRow]
	);
	if (!row) return undefined;

	const updateRowContent = useCallback(
		(configId: string, configValue: string) => {
			dispatchPages({
				type: "UPDATE_ROW_CONTENT",
				pageId: activeRow.pageId,
				rowId: activeRow.rowId,
				configId,
				configValue,
			});
		},
		[activeRow.pageId, activeRow.rowId, dispatchPages]
	);

	const configurationElements = useMemo(
		() =>
			row.config.map((c) => {
				if (c.type === "text") {
					return (
						<form className="grid" key={c.id}>
							<label htmlFor={c.id}>{c.id}</label>
							<input
								id={c.id}
								type="text"
								value={c.value}
								onChange={(e) => {
									updateRowContent(c.id, e.target.value);
								}}
								className="w-full text-sm rounded p-2 border border-opacity-50 focus-visible:outline-none"
								required
							/>
						</form>
					);
				} else {
					return <div key={c.id}>{c.type}</div>;
				}
			}),
		[row.config, activeRow.pageId, activeRow.rowId, dispatchPages]
	);

	return (
		<div className="flex flex-col">
			<div className="p-4 text-xl font-bold text-center">
				Configuration
			</div>
			<div className="flex flex-col min-h-full p-2 gap-2 overflow-scroll">
				{configurationElements}
			</div>
		</div>
	);
}
