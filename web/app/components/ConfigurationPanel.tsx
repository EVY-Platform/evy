import { useCallback, useContext, useEffect, useState } from "react";

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
	const { activeRowId, focusMode, dispatchRow } = useContext(AppContext);
	const row = useRowById(activeRowId);
	const [configStack, setConfigStack] = useState<string[]>([]);
	const currentConfigRowId = configStack.at(-1) ?? row?.id;
	const currentConfigRow = useRowById(currentConfigRowId);

	useEffect(() => {
		if (!activeRowId) {
			setConfigStack([]);
			return;
		}
		setConfigStack([]);
	}, [activeRowId]);

	const openChildConfiguration = useCallback((childRowId: string) => {
		setConfigStack((currentStack) => [...currentStack, childRowId]);
	}, []);

	const handleOpenChildConfiguration = useCallback(
		(childRowId: string) => {
			openChildConfiguration(childRowId);
			if (!focusMode) {
				dispatchRow({ type: "TOGGLE_FOCUS_MODE" });
			}
		},
		[openChildConfiguration, focusMode, dispatchRow],
	);

	const goBackToParentConfiguration = useCallback(() => {
		setConfigStack((currentStack) => currentStack.slice(0, -1));
	}, []);

	const handleGoBackToParentConfiguration = useCallback(() => {
		const willReturnToRoot = configStack.length <= 1;
		goBackToParentConfiguration();
		if (willReturnToRoot && focusMode) {
			dispatchRow({ type: "TOGGLE_FOCUS_MODE" });
		}
	}, [configStack.length, goBackToParentConfiguration, focusMode, dispatchRow]);

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
			if (!currentConfigRow) return;
			dispatchRow({
				type: "UPDATE_ROW_ACTIONS",
				rowId: currentConfigRow.id,
				actions: nextActions,
			});
		},
		[currentConfigRow, dispatchRow],
	);

	const updateActionField = useCallback(
		(
			actionIndex: number,
			field: "condition" | "false" | "true",
			value: string,
		) => {
			if (!currentConfigRow) return;
			const nextActions = currentConfigRow.config.actions.map(
				(action, index) =>
					index === actionIndex ? { ...action, [field]: value } : action,
			);
			updateRowActions(nextActions);
		},
		[currentConfigRow, updateRowActions],
	);

	const addAction = useCallback(() => {
		if (!currentConfigRow) return;
		updateRowActions([
			...currentConfigRow.config.actions,
			{ condition: "", false: "", true: "" },
		]);
	}, [currentConfigRow, updateRowActions]);

	const renderConfiguration = useCallback(
		(configRow: Row): React.ReactNode[] => {
			const content = configRow.config.view.content;

			return Object.entries(content).map(([key, value]) => {
				const uniqueId = `${configRow.id}-${key}`;

				if (key === "children") {
					if (!isRowArray(value)) return null;
					const children = value;
					return (
						<div key={uniqueId}>
							<div className="evy-text-sm evy-font-medium evy-text-black evy-mb-2">
								Children
							</div>
							<div className="evy-flex evy-flex-col evy-gap-4">
								{children.map((child) => {
									return (
										<button
											type="button"
											key={child.id}
											className="evy-flex evy-items-center evy-justify-between evy-gap-3 evy-p-3 evy-bg-white evy-border evy-border-gray evy-text-left evy-cursor-pointer evy-hover:bg-gray-light"
											onClick={() => handleOpenChildConfiguration(child.id)}
										>
											<span>{child.config.type}</span>
											<img
												className="evy-h-4 evy-w-4"
												src="/chevron_right.svg"
												alt=""
											/>
										</button>
									);
								})}
							</div>
						</div>
					);
				}
				if (key === "child") {
					if (!isRow(value)) return null;
					const child = value;
					return (
						<button
							type="button"
							key={uniqueId}
							className="evy-flex evy-items-center evy-justify-between evy-gap-3 evy-p-3 evy-bg-white evy-border evy-border-gray evy-text-left evy-cursor-pointer evy-hover:bg-gray-light"
							onClick={() => handleOpenChildConfiguration(child.id)}
						>
							<span>{child.config.type}</span>
							<img
								className="evy-h-4 evy-w-4"
								src="/chevron_right.svg"
								alt=""
							/>
						</button>
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
		[handleOpenChildConfiguration, updateRowContent],
	);

	const configurationElements = currentConfigRow
		? renderConfiguration(currentConfigRow)
		: [];
	const rowActions = currentConfigRow?.config.actions ?? [];
	const isDrilledIntoChild = configStack.length > 0;

	return (
		<div className="evy-flex evy-flex-col evy-h-full">
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
				Configuration
			</div>
			<div className="evy-flex evy-flex-col evy-min-h-full evy-p-4 evy-gap-4 evy-overflow-scroll">
				{isDrilledIntoChild && currentConfigRow && (
					<>
						<button
							type="button"
							className="evy-flex evy-items-center evy-w-full evy-p-0 evy-bg-transparent evy-border-none evy-text-left evy-cursor-pointer"
							onClick={handleGoBackToParentConfiguration}
							aria-label={`Back to parent configuration from ${currentConfigRow.config.type}`}
						>
							<img className="evy-h-4 evy-w-4" src="/chevron_left.svg" alt="" />
							<span className="evy-text-lg evy-font-semibold evy-pl-4">
								{currentConfigRow.config.type}
							</span>
						</button>
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
