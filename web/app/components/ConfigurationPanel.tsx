import { useCallback, useContext, useMemo } from "react";

import { AppContext } from "../state";
import type { Row } from "../types/row";
import { useRowById } from "../hooks/useRowById";

export function ConfigurationPanel() {
	const { activeRowId, activePageId, flows, activeFlowId, dispatchRow } =
		useContext(AppContext);
	const row = useRowById(activeRowId);

	const activePage = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.find((p) => p.id === activePageId),
		[flows, activeFlowId, activePageId],
	);

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
		[activeRowId, dispatchRow],
	);

	const renderConfiguration = useCallback(
		(configRow: Row): React.ReactNode[] => {
			const content = configRow.config.view.content;

			return Object.keys(content).map((key) => {
				const uniqueId = `${configRow.id}-${key}`;

				if (key === "children") {
					const children = content.children;
					if (!children) return null;
					return (
						<div key={uniqueId} className="evy-flex evy-flex-col evy-gap-4">
							{children.map((child, index) => {
								return (
									<div
										key={child.id}
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
				}
				if (key === "child") {
					const child = content.child;
					if (!child) return null;
					return (
						<div
							key={uniqueId}
							className="evy-p-2 evy-bg-gray-light evy-border evy-border-gray"
						>
							<p className="evy-text-lg evy-font-semibold evy-mb-4">Child</p>
							{renderConfiguration(child)}
						</div>
					);
				}
				return (
					<div className="evy-mb-2" key={uniqueId}>
						<label htmlFor={uniqueId}>{key}</label>
						<input
							id={uniqueId}
							type="text"
							value={String(content[key])}
							onChange={(e) => {
								updateRowContent(key, e.target.value, configRow.id);
							}}
							className="evy-w-full evy-focus-visible:outline-none"
							required
						/>
					</div>
				);
			});
		},
		[updateRowContent],
	);

	const configurationElements = row ? renderConfiguration(row) : [];

	return (
		<div className="evy-flex evy-flex-col evy-h-full">
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
				Configuration
			</div>
			<div className="evy-flex evy-flex-col evy-min-h-full evy-p-4 evy-gap-4 evy-overflow-scroll">
				{activePage && (
					<>
						<div className="evy-mb-2">
							<label htmlFor="page-title">Page title</label>
							<input
								id="page-title"
								type="text"
								value={activePage.title}
								onChange={(e) =>
									dispatchRow({
										type: "UPDATE_PAGE_TITLE",
										pageId: activePage.id,
										title: e.target.value,
									})
								}
								className="evy-w-full evy-focus-visible:outline-none"
							/>
						</div>
						<div className="evy-border-b evy-border-gray" />
					</>
				)}
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
