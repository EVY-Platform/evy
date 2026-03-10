import { useCallback, useContext, useMemo } from "react";

import { AppContext } from "../state";
import type { Row } from "../types/row";
import { useRowById } from "../hooks/useRowById";

function isRow(value: unknown): value is Row {
	return value !== null && typeof value === "object" && "config" in value;
}

function isRowArray(value: unknown): value is Row[] {
	return Array.isArray(value) && value.every(isRow);
}

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

	const updateRowActions = useCallback(
		(nextActions: NonNullable<Row["config"]["actions"]>) => {
			if (!row) return;
			dispatchRow({
				type: "UPDATE_ROW_ACTIONS",
				rowId: row.id,
				actions: nextActions,
			});
		},
		[row, dispatchRow],
	);

	const updateActionField = useCallback(
		(
			actionIndex: number,
			field: "condition" | "false" | "true",
			value: string,
		) => {
			if (!row) return;
			const nextActions = row.config.actions.map((action, index) =>
				index === actionIndex ? { ...action, [field]: value } : action,
			);
			updateRowActions(nextActions);
		},
		[row, updateRowActions],
	);

	const addAction = useCallback(() => {
		if (!row) return;
		updateRowActions([
			...row.config.actions,
			{ condition: "", false: "", true: "" },
		]);
	}, [row, updateRowActions]);

	const renderConfiguration = useCallback(
		(configRow: Row): React.ReactNode[] => {
			const content = configRow.config.view.content;

			return Object.entries(content).map(([key, value]) => {
				const uniqueId = `${configRow.id}-${key}`;

				if (key === "children") {
					if (!isRowArray(value)) return null;
					const children = value;
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
					if (!isRow(value)) return null;
					const child = value;
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
							value={String(value)}
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
	const rowActions = row?.config.actions ?? [];

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
					<>
						{configurationElements}
						<div className="evy-border-b evy-border-gray" />
						<div>
							<div className="evy-flex evy-items-center evy-justify-between evy-mb-4">
								<p className="evy-text-lg evy-font-semibold">Actions</p>
								<button
									type="button"
									className="evy-text-sm evy-bg-transparent evy-border-none evy-rounded-sm evy-text-black evy-cursor-pointer evy-hover:bg-gray-light"
									onClick={addAction}
								>
									Add action
								</button>
							</div>
							{rowActions.length > 0 ? (
								<div className="evy-flex evy-flex-col evy-gap-4">
									{rowActions.map((action, index) => {
										const conditionId = `condition-${index}`;
										const falseId = `false-${index}`;
										const trueId = `true-${index}`;

										return (
											<div
												key={conditionId}
												className="evy-p-2 evy-bg-gray-light evy-border evy-border-gray"
											>
												<div className="evy-mb-2">
													<label htmlFor={conditionId}>{conditionId}</label>
													<input
														id={conditionId}
														type="text"
														value={action.condition}
														onChange={(e) =>
															updateActionField(
																index,
																"condition",
																e.target.value,
															)
														}
														className="evy-w-full evy-focus-visible:outline-none"
													/>
												</div>
												<div className="evy-mb-2">
													<label htmlFor={falseId}>{falseId}</label>
													<input
														id={falseId}
														type="text"
														value={action.false}
														onChange={(e) =>
															updateActionField(index, "false", e.target.value)
														}
														className="evy-w-full evy-focus-visible:outline-none"
													/>
												</div>
												<div className="evy-mb-2">
													<label htmlFor={trueId}>{trueId}</label>
													<input
														id={trueId}
														type="text"
														value={action.true}
														onChange={(e) =>
															updateActionField(index, "true", e.target.value)
														}
														className="evy-w-full evy-focus-visible:outline-none"
													/>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div className="evy-text-sm evy-text-gray">
									Row has no actions
								</div>
							)}
						</div>
					</>
				) : (
					<div className="evy-text-sm evy-text-gray evy-text-center evy-mt-8">
						Select a row to configure
					</div>
				)}
			</div>
		</div>
	);
}
