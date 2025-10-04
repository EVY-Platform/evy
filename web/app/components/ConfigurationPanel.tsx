import { useCallback, useContext, useMemo } from "react";

import { AppContext } from "../registry";

export function ConfigurationPanel() {
	const { flows, activeFlowId, activeRowId, dispatchRow } =
		useContext(AppContext);

	if (!activeRowId) return;

	const pages = flows.find((f) => f.id === activeFlowId)?.pages || [];
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === activeRowId);

	const updateRowContent = useCallback(
		(configId: string, configValue: string) => {
			if (!activeRowId) return;
			dispatchRow({
				type: "UPDATE_ROW_CONTENT",
				rowId: activeRowId,
				configId,
				configValue,
			});
		},
		[activeRowId, dispatchRow]
	);

	const configurationElements = useMemo(
		() =>
			row?.config.map((c) => {
				if (c.type === "text") {
					return (
						<form className="evy-grid" key={c.id}>
							<label htmlFor={c.id}>{c.id}</label>
							<input
								id={c.id}
								type="text"
								value={c.value}
								onChange={(e) => {
									updateRowContent(c.id, e.target.value);
								}}
								className="evy-box-sizing-border evy-text-sm evy-rounded evy-p-2 evy-border evy-focus-visible\:outline-none"
								required
							/>
						</form>
					);
				} else {
					return <div key={c.id}>{c.type}</div>;
				}
			}) || [],
		[row?.config]
	);

	return (
		<div className="evy-flex evy-flex-col">
			<div className="evy-p-4 evy-text-xl evy-font-bold evy-text-center">
				Configuration
			</div>
			<div className="evy-flex evy-flex-col evy-min-h-full evy-p-2 evy-gap-2 evy-overflow-scroll">
				{configurationElements}
			</div>
		</div>
	);
}
