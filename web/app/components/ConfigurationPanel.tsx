import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import { ChevronRight, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRowById } from "../hooks/useRowById";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { useFlowsContext } from "../state";
import type { Row } from "../types/row";
import { mergeRowContentWithPaletteDefaults } from "../utils/decodeFlow";
import {
	buildDatumCandidate,
	buildFunctionCandidates,
	buildIdCandidates,
	buildResourceAttributeCandidatesForResource,
	buildRowAttributeCandidates,
	type IdCandidate,
} from "../utils/idCandidates";
import {
	findPageReferences,
	type PageReferenceEntry,
} from "../utils/pageReferences";
import { unwrapOptionalBraces } from "../utils/unwrapBraces";
import { ActionEditor } from "./ActionEditor";
import { BuilderAssist } from "./BuilderAssist";
import { PageInUseDialog } from "./PageInUseDialog";

function isContainerKey(k: string): boolean {
	return k === "childRowId" || k === "childrenRowIds";
}

const panelFieldOrder = ["icon", "title", "subtitle", "text", "placeholder"];

function getPanelFieldRank(key: string): number {
	const index = panelFieldOrder.indexOf(key.toLowerCase());
	return index === -1 ? panelFieldOrder.length : index;
}

function sortContentEntriesForPanel(
	entries: [string, unknown][],
): [string, unknown][] {
	return entries.sort(([a], [b]) => {
		const rankDifference = getPanelFieldRank(a) - getPanelFieldRank(b);
		if (rankDifference !== 0) return rankDifference;
		if (isContainerKey(a) && isContainerKey(b)) {
			return a === "childRowId" ? -1 : 1;
		}
		return a.localeCompare(b);
	});
}

function resolveSourceResourceId(
	source: string,
	serviceResources: { id: string }[],
): string | null {
	const sourcePath = unwrapOptionalBraces(source);
	const resourceId = sourcePath.split(".")[0]?.trim();
	if (!resourceId) return null;
	return serviceResources.some((resource) => resource.id === resourceId)
		? resourceId
		: null;
}

function resolveQualifierResourceId(
	qualifier: string,
	source: string,
	serviceResources: { id: string }[],
): string | null {
	if (qualifier === "$datum")
		return resolveSourceResourceId(source, serviceResources);
	return serviceResources.some((resource) => resource.id === qualifier)
		? qualifier
		: null;
}

function ConfigTextField({
	id,
	label,
	value,
	onChange,
	placeholder,
	ariaLabel,
	labelClassName,
	fieldClassName = "evy-mb-2",
	candidates,
	getAttributeCandidatesForQualifier,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (next: string) => void;
	candidates: IdCandidate[];
	placeholder?: string;
	ariaLabel?: string;
	labelClassName?: string;
	fieldClassName?: string;
	getAttributeCandidatesForQualifier?: (qualifier: string) => IdCandidate[];
}) {
	return (
		<div className={fieldClassName}>
			<BuilderAssist
				id={id}
				label={label}
				value={value}
				onChange={onChange}
				candidates={candidates}
				placeholder={placeholder}
				ariaLabel={ariaLabel}
				labelClassName={labelClassName}
				getAttributeCandidatesForQualifier={
					getAttributeCandidatesForQualifier
				}
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
		flowsById,
		pagesById,
		rowsById,
		serviceResources,
		resourceAttributeMetadata,
		configStack,
		dispatchRow,
	} = useFlowsContext();
	const row = useRowById(activeRowId);
	const currentConfigRowId = configStack.at(-1) ?? row?.id;
	const currentConfigRow = useRowById(currentConfigRowId);

	const activeFlow = activeFlowId ? flowsById[activeFlowId] : undefined;
	const activePage = activePageId ? pagesById[activePageId] : undefined;

	const showPageTitleInPanel =
		Boolean(activePage) && configStack.length === 0;

	const builderAssistCandidates = useMemo(
		() => [
			...buildIdCandidates(flowsById, pagesById, serviceResources),
			...buildRowAttributeCandidates(rowsById),
			buildDatumCandidate(),
			...buildFunctionCandidates(),
		],
		[flowsById, pagesById, rowsById, serviceResources],
	);

	const [pageInUseReferences, setPageInUseReferences] = useState<
		PageReferenceEntry[]
	>([]);

	const canDeleteCurrentPage = Boolean(
		activeFlow && activePage && activeFlow.pageIds.length > 1,
	);

	const handleDeletePageClick = useCallback(() => {
		if (!activeFlowId || !activePage || !canDeleteCurrentPage) return;
		const references = findPageReferences(
			activeFlowId,
			activePage.id,
			flowsById,
			pagesById,
			rowsById,
		);
		if (references.length > 0) {
			setPageInUseReferences(references);
			return;
		}
		dispatchRow({ type: "REMOVE_PAGE", pageId: activePage.id });
	}, [
		activeFlowId,
		activePage,
		canDeleteCurrentPage,
		flowsById,
		pagesById,
		rowsById,
		dispatchRow,
	]);

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
		(
			field: "source" | "destination" | "visible",
			value: string,
			targetRowId?: string,
		) => {
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
			const merged = mergeRowContentWithPaletteDefaults(configRow);
			// Filter out old-style container keys that may appear from palette defaults
			const filteredEntries = Object.entries(merged).filter(
				([key]) => key !== "child" && key !== "children",
			);
			const entries = sortContentEntriesForPanel(filteredEntries);
			const contentEntries = entries.filter(
				([key]) => !isContainerKey(key),
			);
			const containerEntries = entries.filter(([key]) =>
				isContainerKey(key),
			);

			const getAttributeCandidatesForQualifier = (qualifier: string) => {
				const resourceId = resolveQualifierResourceId(
					qualifier,
					configRow.config.source,
					serviceResources,
				);
				return resourceId
					? buildResourceAttributeCandidatesForResource(
							resourceAttributeMetadata,
							resourceId,
						)
					: [];
			};

			const contentElements = contentEntries.map(([key, value]) => {
				const uniqueId = `${configRow.id}-${key}`;

				return (
					<ConfigTextField
						key={uniqueId}
						id={uniqueId}
						label={key}
						value={String(value)}
						onChange={(next) =>
							updateRowContent(key, next, configRow.id)
						}
						candidates={builderAssistCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
					/>
				);
			});

			const containerElements = containerEntries.map(([key, value]) => {
				const uniqueId = `${configRow.id}-${key}`;

				let childInfos: { id: string; type: string }[] = [];
				if (key === "childRowId" && typeof value === "string") {
					const record = rowsById[value];
					if (record) childInfos = [{ id: value, type: record.type }];
				} else if (key === "childrenRowIds" && Array.isArray(value)) {
					childInfos = (value as string[])
						.map((id) => {
							const rec = rowsById[id];
							return rec ? { id, type: rec.type } : null;
						})
						.filter(
							(item): item is { id: string; type: string } =>
								item !== null,
						);
				}

				if (childInfos.length === 0) return null;
				const label = key === "childRowId" ? "Child" : "Children";

				return (
					<div key={uniqueId}>
						<div className="evy-text-sm evy-font-medium evy-text-black evy-mb-2">
							{label}
						</div>
						<div
							className={
								childInfos.length > 1
									? "evy-flex evy-flex-col evy-gap-4"
									: undefined
							}
						>
							{childInfos.map(({ id, type }) => (
								<ChildRowButton
									key={id}
									child={{ id, config: { type } } as Row}
									onClick={() =>
										openChildConfiguration(id, configRow)
									}
								/>
							))}
						</div>
					</div>
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
						onChange={(next) =>
							updateRowRoot("source", next, configRow.id)
						}
						candidates={builderAssistCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
						placeholder="Where the row reads data from"
						ariaLabel="Row data source"
						labelClassName="evy-text-sm evy-font-medium evy-text-black"
						fieldClassName=""
					/>
					<ConfigTextField
						id={`${configRow.id}-destination`}
						label="Destination"
						value={configRow.config.destination ?? ""}
						onChange={(next) =>
							updateRowRoot("destination", next, configRow.id)
						}
						candidates={builderAssistCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
						placeholder="Where the row writes data to"
						ariaLabel="Row destination"
						labelClassName="evy-text-sm evy-font-medium evy-text-black"
						fieldClassName=""
					/>
					<ConfigTextField
						id={`${configRow.id}-visible`}
						label="Visible"
						value={configRow.config.visible ?? ""}
						onChange={(next) =>
							updateRowRoot("visible", next, configRow.id)
						}
						candidates={builderAssistCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
						placeholder={`Condition to show row, e.g. {${MARKETPLACE_RESOURCE.ITEMS}.payment_methods.cash == true}`}
						ariaLabel="Row visibility condition"
						labelClassName="evy-text-sm evy-font-medium evy-text-black"
						fieldClassName=""
					/>
				</div>,
				...containerElements,
			];
		},
		[
			openChildConfiguration,
			updateRowContent,
			updateRowRoot,
			builderAssistCandidates,
			resourceAttributeMetadata,
			serviceResources,
			rowsById,
		],
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
							value={activePage.title ?? ""}
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
						<p className="evy-text-lg evy-font-semibold">
							{currentConfigRow.config.type} Row
						</p>
						{configurationElements}
						<div className="evy-border-b evy-border-gray" />
						<ActionEditor
							actions={currentConfigRow.config.actions}
							flowsById={flowsById}
							pagesById={pagesById}
							serviceResources={serviceResources}
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
