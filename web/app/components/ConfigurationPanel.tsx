import { useCallback, useContext, useMemo } from "react";

import { AppContext } from "../registry";
import { Row, EVYRow } from "../rows/EVYRow";

export function ConfigurationPanel() {
	const { flows, activeFlowId, activeRowId, dispatchRow } =
		useContext(AppContext);

	const updateRowContent = useCallback(
		(configId: string, configValue: string, targetRowId?: string) => {
			const rowId = targetRowId || activeRowId;
			if (!rowId) return;
			dispatchRow({
				type: "UPDATE_ROW_CONTENT",
				rowId,
				configId,
				configValue,
			});
		},
		[activeRowId, dispatchRow]
	);

	const pages = flows.find((f) => f.id === activeFlowId)?.pages || [];
	const row = useMemo(
		() =>
			pages
				.flatMap((page) => page.rows)
				.flatMap(EVYRow.getRowsRecursive)
				.find((r) => r.rowId === activeRowId),
		[pages, activeRowId]
	);

	const renderConfiguration = useCallback(
		(configRow: Row): React.ReactNode[] => {
			const content = configRow.config.view.content;

			return Object.keys(content).map((key) => {
				const uniqueId = `${configRow.rowId}-${key}`;

				if (key === "children") {
					const children = content[key] as Row[];
					return (
						<div key={uniqueId} className="evy-flex evy-flex-col">
							{children.map((child, index) => {
								return (
									<div key={child.rowId}>
										<div className="evy-mt-2 evy-mb-2">
											<p className="evy-text-lg evy-font-bold">
												Child {index + 1}
											</p>
											{renderConfiguration(child)}
										</div>
									</div>
								);
							})}
						</div>
					);
				} else if (key === "child") {
					return (
						<div key={uniqueId} className="evy-mt-2 evy-mb-2">
							<p className="evy-text-lg evy-font-bold">Child</p>
							{renderConfiguration(content[key] as Row)}
						</div>
					);
				} else {
					return (
						<form className="evy-grid" key={uniqueId}>
							<label htmlFor={uniqueId}>{key}</label>
							<input
								id={uniqueId}
								type="text"
								value={String(content[key])}
								onChange={(e) => {
									updateRowContent(
										key,
										e.target.value,
										configRow.rowId
									);
								}}
								className="evy-box-sizing-border evy-text-sm evy-rounded-sm evy-p-2 evy-border evy-focus-visible:outline-none"
								required
							/>
						</form>
					);
				}
			});
		},
		[updateRowContent]
	);

	const configurationElements = row ? renderConfiguration(row) : [];

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
