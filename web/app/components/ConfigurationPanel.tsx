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
				type: "UPDATE_ROW",
				rowId,
				configId,
				configValue,
			});
		},
		[activeRowId, dispatchRow]
	);

	const row = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.flatMap((page) => page.rows)
				.flatMap(EVYRow.getRowsRecursive)
				.find((r) => r.rowId === activeRowId),
		[flows, activeFlowId, activeRowId]
	);

	const renderConfiguration = useCallback(
		(configRow: Row): React.ReactNode[] => {
			const content = configRow.config.view.content;

			return Object.keys(content).map((key) => {
				const uniqueId = `${configRow.rowId}-${key}`;

				if (key === "children") {
					const children = content[key] as Row[];
					return (
						<div
							key={uniqueId}
							className="evy-flex evy-flex-col evy-gap-4"
						>
							{children.map((child, index) => {
								return (
									<div
										key={child.rowId}
										className="evy-p-2 evy-bg-gray-light evy-border evy-border-gray"
									>
										<p className="evy-text-lg evy-font-semibold evy-mb-4">
											Child {index + 1}
										</p>
										{renderConfiguration(child)}
									</div>
								);
							})}
						</div>
					);
				} else if (key === "child") {
					return (
						<div
							key={uniqueId}
							className="evy-p-2 evy-bg-gray-light evy-border evy-border-gray"
						>
							<p className="evy-text-lg evy-font-semibold evy-mb-4">
								Child
							</p>
							{renderConfiguration(content[key] as Row)}
						</div>
					);
				} else {
					return (
						<div className="evy-mb-2" key={uniqueId}>
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
								className="evy-w-full evy-focus-visible:outline-none"
								required
							/>
						</div>
					);
				}
			});
		},
		[updateRowContent]
	);

	const configurationElements = row ? renderConfiguration(row) : [];

	return (
		<div className="evy-flex evy-flex-col evy-h-full">
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
				Configuration
			</div>
			<div className="evy-flex evy-flex-col evy-min-h-full evy-p-4 evy-gap-4 evy-overflow-scroll">
				{configurationElements.length > 0 ? (
					configurationElements
				) : (
					<div className="evy-text-sm evy-text-gray evy-text-center evy-mt-8">
						Select a row to configure
					</div>
				)}
			</div>
		</div>
	);
}
