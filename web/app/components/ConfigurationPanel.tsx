import { useCallback, useContext, useMemo } from "react";

import { AppContext } from "../registry";

export function ConfigurationPanel() {
	const { flows, activeFlowId, activeRowId, dispatchRow } =
		useContext(AppContext);

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

	const configurationElements = useMemo(() => {
		const pages = flows.find((f) => f.id === activeFlowId)?.pages || [];
		const row = pages
			.flatMap((page) => page.rowsData)
			.find((r) => r.rowId === activeRowId);

		return (
			Object.keys(row?.config.view.content || {}).map((key) => {
				return (
					<form className="evy-grid" key={key}>
						<label htmlFor={key}>{key}</label>
						<input
							id={key}
							type="text"
							value={row?.config.view.content[key]}
							onChange={(e) => {
								updateRowContent(key, e.target.value);
							}}
							className="evy-box-sizing-border evy-text-sm evy-rounded evy-p-2 evy-border evy-focus-visible\:outline-none"
							required
						/>
					</form>
				);
			}) || []
		);
	}, [flows, activeFlowId, activeRowId, updateRowContent]);

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
