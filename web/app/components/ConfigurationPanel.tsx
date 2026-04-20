import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";

import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { useFlowsContext } from "../state";
import type { Row } from "../types/row";
import { useRowById } from "../hooks/useRowById";
import { findFlowById } from "../utils/flowHelpers";
import {
	findPageReferences,
	type PageReferenceEntry,
} from "../utils/actionHelpers";
import { ActionEditor } from "./ActionEditor";
import { PageInUseDialog } from "./PageInUseDialog";

function isRow(value: unknown): value is Row {
	return value !== null && typeof value === "object" && "config" in value;
}

function isRowArray(value: unknown): value is Row[] {
	return Array.isArray(value) && value.every(isRow);
}

function ConfigTextField({
	id,
	label,
	value,
	onChange,
	placeholder,
	ariaLabel,
	labelClassName,
	inputClassName = "evy-w-full evy-focus-visible:outline-none",
	required,
	fieldClassName = "evy-mb-2",
}: {
	id: string;
	label: string;
	value: string;
	onChange: (next: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	labelClassName?: string;
	inputClassName?: string;
	required?: boolean;
	fieldClassName?: string;
}) {
	return (
		<div className={fieldClassName}>
			<label htmlFor={id} className={labelClassName}>
				{label}
			</label>
			<input
				id={id}
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-label={ariaLabel}
				className={inputClassName}
				required={required}
			/>
		</div>
	);
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
			className="evy-w-full evy-flex evy-items-center evy-justify-between evy-gap-3 evy-p-3 evy-bg-white evy-border evy-border-gray evy-text-left evy-cursor-pointer evy-hover:bg-gray-light"
			onClick={onClick}
		>
			<span>{child.config.type}</span>
			<ChevronRight
				className="evy-h-4 evy-w-4"
				strokeWidth={LUCIDE_STROKE_WIDTH}
				aria-hidden
			/>
		</button>
	);
}

export function ConfigurationPanel() {
	const {
		activeRowId,
		activePageId,
		activeFlowId,
		flows,
		configStack,
		dispatchRow,
	} = useFlowsContext();
	const row = useRowById(activeRowId);
	const currentConfigRowId = configStack.at(-1) ?? row?.id;
	const currentConfigRow = useRowById(currentConfigRowId);

	const activeFlow = useMemo(
		() => findFlowById(flows, activeFlowId),
		[flows, activeFlowId],
	);

	const activePage = useMemo(
		() => activeFlow?.pages.find((p) => p.id === activePageId),
		[activeFlow, activePageId],
	);

	const showPageTitleInPanel = Boolean(activePage) && configStack.length === 0;

	const [pageInUseReferences, setPageInUseReferences] = useState<
		PageReferenceEntry[]
	>([]);

	const canDeleteCurrentPage = Boolean(
		activeFlow && activePage && activeFlow.pages.length > 1,
	);

	const handleDeletePageClick = useCallback(() => {
		if (!activeFlow || !activePage || !canDeleteCurrentPage) return;
		const references = findPageReferences(activeFlow, activePage.id);
		if (references.length > 0) {
			setPageInUseReferences(references);
			return;
		}
		dispatchRow({ type: "REMOVE_PAGE", pageId: activePage.id });
	}, [activeFlow, activePage, canDeleteCurrentPage, dispatchRow]);

	const dismissPageInUseDialog = useCallback(() => {
		setPageInUseReferences([]);
	}, []);

	const openChildConfiguration = useCallback(
		(childRowId: string, parentRow: Row) => {
			dispatchRow({
				type: "PUSH_CONFIG_STACK",
				parentRowId: parentRow.id,
				childRowId,
			});
		},
		[dispatchRow],
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

	const updateRowRoot = useCallback(
		(field: "source" | "destination", value: string, targetRowId?: string) => {
			const rowId = targetRowId || activeRowId;
			if (!rowId) return;
			dispatchRow({
				type: "UPDATE_ROW_ROOT",
				rowId,
				field,
				value,
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
			const entries = Object.entries(content).sort(([a], [b]) => {
				const isContainerKey = (k: string) => k === "child" || k === "children";
				if (isContainerKey(a) && !isContainerKey(b)) return 1;
				if (!isContainerKey(a) && isContainerKey(b)) return -1;
				return 0;
			});

			const contentElements = entries.map(([key, value]) => {
				const uniqueId = `${configRow.id}-${key}`;

				if (key === "child" || key === "children") {
					const items =
						key === "child"
							? isRow(value)
								? [value]
								: []
							: isRowArray(value)
								? value
								: [];
					if (items.length === 0) return null;
					const label = key === "child" ? "Child" : "Children";
					return (
						<div key={uniqueId}>
							<div className="evy-text-sm evy-font-medium evy-text-black evy-mb-2">
								{label}
							</div>
							<div
								className={
									items.length > 1
										? "evy-flex evy-flex-col evy-gap-4"
										: undefined
								}
							>
								{items.map((childRow) => (
									<ChildRowButton
										key={childRow.id}
										child={childRow}
										onClick={() =>
											openChildConfiguration(childRow.id, configRow)
										}
									/>
								))}
							</div>
						</div>
					);
				}
				return (
					<ConfigTextField
						key={uniqueId}
						id={uniqueId}
						label={key}
						value={String(value)}
						onChange={(next) => updateRowContent(key, next, configRow.id)}
						required
					/>
				);
			});

			return [
				...contentElements,
				<div
					className="evy-flex evy-flex-col evy-gap-3"
					key={`${configRow.id}-bindings`}
				>
					<ConfigTextField
						id={`${configRow.id}-source`}
						label="Source"
						value={configRow.config.source}
						onChange={(next) => updateRowRoot("source", next, configRow.id)}
						placeholder="Where the row reads data from"
						ariaLabel="Row data source"
						labelClassName="evy-text-sm evy-font-medium evy-text-black"
						inputClassName="evy-w-full evy-mt-1 evy-focus-visible:outline-none"
						fieldClassName=""
					/>
					<ConfigTextField
						id={`${configRow.id}-destination`}
						label="Destination"
						value={configRow.config.destination ?? ""}
						onChange={(next) =>
							updateRowRoot("destination", next, configRow.id)
						}
						placeholder="Where the row writes data to"
						ariaLabel="Row destination"
						labelClassName="evy-text-sm evy-font-medium evy-text-black"
						inputClassName="evy-w-full evy-mt-1 evy-focus-visible:outline-none"
						fieldClassName=""
					/>
				</div>,
			];
		},
		[openChildConfiguration, updateRowContent, updateRowRoot],
	);

	const configurationElements = currentConfigRow
		? renderConfiguration(currentConfigRow)
		: [];

	return (
		<div className="evy-flex evy-flex-col evy-h-full">
			<PageInUseDialog
				references={pageInUseReferences}
				onClose={dismissPageInUseDialog}
			/>
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
				Configuration
			</div>
			<div className="evy-flex evy-flex-col evy-min-h-full evy-p-4 evy-gap-4 evy-overflow-scroll">
				{showPageTitleInPanel && activePage && (
					<div className="evy-mb-2">
						<div className="evy-flex evy-items-center evy-justify-between evy-gap-2">
							<label
								htmlFor="config-panel-page-title"
								className="evy-text-sm evy-font-medium evy-text-black"
							>
								Page title
							</label>
							<button
								type="button"
								className="evy-bin-button evy-bg-transparent evy-border-none evy-cursor-pointer evy-shrink-0"
								onClick={handleDeletePageClick}
								disabled={!canDeleteCurrentPage}
								aria-label="Remove page from flow"
								title={
									canDeleteCurrentPage
										? "Remove page from flow"
										: "Cannot remove the only page in this flow"
								}
							>
								<Trash2
									className="evy-h-4 evy-w-4"
									strokeWidth={LUCIDE_STROKE_WIDTH}
									aria-hidden
								/>
							</button>
						</div>
						<input
							id="config-panel-page-title"
							type="text"
							value={activePage.title}
							onChange={(e) =>
								dispatchRow({
									type: "UPDATE_PAGE_TITLE",
									pageId: activePage.id,
									title: e.target.value,
								})
							}
							placeholder="Page title"
							aria-label="Page title"
							className="evy-w-full evy-mt-1 evy-focus-visible:outline-none"
						/>
					</div>
				)}
				{showPageTitleInPanel && activePage && currentConfigRow && (
					<div className="evy-border-b evy-border-gray" />
				)}
				{currentConfigRow ? (
					<>
						{configurationElements}
						<div className="evy-border-b evy-border-gray" />
						<ActionEditor
							actions={currentConfigRow.config.actions ?? []}
							flows={flows}
							onUpdate={updateRowActions}
						/>
					</>
				) : (
					<div
						className={`evy-text-sm evy-text-gray evy-text-center ${showPageTitleInPanel ? "evy-mt-4" : "evy-mt-8"}`}
					>
						Select a row to configure
					</div>
				)}
			</div>
		</div>
	);
}
