import { useCallback, useContext, useEffect, useState } from "react";

import { AppContext } from "../state";
import type { Row } from "../types/row";
import { useRowById } from "../hooks/useRowById";
import { ActionEditor } from "./ActionEditor";

function isRow(value: unknown): value is Row {
	return value !== null && typeof value === "object" && "config" in value;
}

function isRowArray(value: unknown): value is Row[] {
	return Array.isArray(value) && value.every(isRow);
}

function ChildRowButton({
	child,
	onClick,
}: {
	child: Row;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="evy-flex evy-items-center evy-justify-between evy-gap-3 evy-p-3 evy-bg-white evy-border evy-border-gray evy-text-left evy-cursor-pointer evy-hover:bg-gray-light"
			onClick={onClick}
		>
			<span>{child.config.type}</span>
			<img className="evy-h-4 evy-w-4" src="/chevron_right.svg" alt="" />
		</button>
	);
}

export function ConfigurationPanel() {
	const { activeRowId, flows, focusMode, dispatchRow } = useContext(AppContext);
	const row = useRowById(activeRowId);
	const [configStack, setConfigStack] = useState<string[]>([]);
	const currentConfigRowId = configStack.at(-1) ?? row?.id;
	const currentConfigRow = useRowById(currentConfigRowId);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset stack when selected row changes
	useEffect(() => {
		setConfigStack([]);
	}, [activeRowId]);

	const openChildConfiguration = useCallback(
		(childRowId: string) => {
			setConfigStack((currentStack) => [...currentStack, childRowId]);
			if (!focusMode) {
				dispatchRow({ type: "TOGGLE_FOCUS_MODE" });
			}
		},
		[focusMode, dispatchRow],
	);

	const goBackToParentConfiguration = useCallback(() => {
		const willReturnToRoot = configStack.length <= 1;
		setConfigStack((currentStack) => currentStack.slice(0, -1));
		if (willReturnToRoot && focusMode) {
			dispatchRow({ type: "TOGGLE_FOCUS_MODE" });
		}
	}, [configStack.length, focusMode, dispatchRow]);

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
								{children.map((child) => (
									<ChildRowButton
										key={child.id}
										child={child}
										onClick={() => openChildConfiguration(child.id)}
									/>
								))}
							</div>
						</div>
					);
				}
				if (key === "child") {
					if (!isRow(value)) return null;
					const child = value;
					return (
						<ChildRowButton
							key={uniqueId}
							child={child}
							onClick={() => openChildConfiguration(child.id)}
						/>
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
		[openChildConfiguration, updateRowContent],
	);

	const configurationElements = currentConfigRow
		? renderConfiguration(currentConfigRow)
		: [];
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
							onClick={goBackToParentConfiguration}
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
						<ActionEditor
							actions={currentConfigRow?.config.actions ?? []}
							flows={flows}
							onUpdate={updateRowActions}
						/>
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
