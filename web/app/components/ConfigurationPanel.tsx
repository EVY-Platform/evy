import type { RowTriggerName, UI_RowAction, UI_RowActions } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import { ChevronRight, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRowById } from "../hooks/useRowById";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import {
	BINDING_FIELD_COPY,
	compareRowFieldsForPanel,
	getRowBindingFields,
	getRowContentFields,
	isPanelScalarField,
	type RowBindingField,
} from "../rows/rowFields";
import { getRowTriggers } from "../rows/rowTriggers";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import type { Row } from "../types/row";
import { mergeRowContentWithPaletteDefaults } from "../utils/decodeFlow";
import {
	buildDatumCandidate,
	buildFunctionCandidates,
	buildIdCandidates,
	buildRowAttributeCandidates,
	createGetAttributeCandidatesForQualifier,
	type IdCandidate,
} from "../utils/idCandidates";
import {
	findPageReferences,
	type PageReferenceEntry,
} from "../utils/pageReferences";
import { ActionEditor } from "./ActionEditor";
import { BuilderAssist } from "./BuilderAssist";
import { PageInUseDialog } from "./PageInUseDialog";
import { type PopoverOption, PopoverSelect } from "./PopoverSelect";

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

function ConfigEnumField({
	id,
	label,
	value,
	options,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	options: string[];
	onChange: (next: string) => void;
}) {
	const popoverOptions: PopoverOption[] = options.map((option) => ({
		value: option,
		label: option,
	}));
	const selectedValue = value || options[0] || "";

	return (
		<div className="evy-mb-2">
			<label htmlFor={id}>{label}</label>
			<PopoverSelect
				id={id}
				ariaLabel={label}
				options={popoverOptions}
				value={selectedValue}
				onChange={onChange}
			/>
		</div>
	);
}

type ChildInfo = { id: string; name: string; type: string };

function ChildRowButton({
	name,
	type,
	onClick,
}: {
	name: string;
	type: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="evy-w-full evy-flex evy-items-center evy-justify-between evy-gap-3 evy-p-3 evy-bg-white evy-border evy-border-gray evy-text-left evy-cursor-pointer evy-hover:bg-gray-light"
			onClick={onClick}
		>
			<span>
				{name}: {type}
			</span>
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
			...buildRowAttributeCandidates(),
			buildDatumCandidate(),
			...buildFunctionCandidates(),
		],
		[flowsById, pagesById, serviceResources],
	);

	const submitsServiceOptions = useMemo<PopoverOption[]>(
		() => [
			{ value: "", label: "None" },
			{ value: MARKETPLACE_SERVICE, label: "Marketplace" },
			{ value: EVY_CORE_SERVICE, label: "Evy" },
		],
		[],
	);

	const submitsResourceOptions = useMemo<PopoverOption[]>(() => {
		const serviceId = activeFlow?.submits?.service;
		if (!serviceId) return [];
		return serviceResources
			.filter((resource) => resource.fkServiceId === serviceId)
			.map((resource) => ({ value: resource.id, label: resource.name }))
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [activeFlow?.submits?.service, serviceResources]);

	// Changing service invalidates the resource, so the declaration is held
	// incomplete until a resource is picked rather than pointing at a resource
	// the new service does not own.
	const handleSubmitsServiceChange = useCallback(
		(service: string) => {
			if (!activeFlowId) return;
			dispatchRow({
				type: "UPDATE_FLOW_SUBMITS",
				flowId: activeFlowId,
				submits: service ? { service, resource: "" } : undefined,
			});
		},
		[activeFlowId, dispatchRow],
	);

	const handleSubmitsResourceChange = useCallback(
		(resource: string) => {
			const service = activeFlow?.submits?.service;
			if (!activeFlowId || !service) return;
			dispatchRow({
				type: "UPDATE_FLOW_SUBMITS",
				flowId: activeFlowId,
				submits: resource ? { service, resource } : undefined,
			});
		},
		[activeFlowId, activeFlow?.submits?.service, dispatchRow],
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
			field: RowBindingField | "visible",
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

	const updateRowActionsForTrigger = useCallback(
		(trigger: RowTriggerName, nextTriggerActions: UI_RowAction[]) => {
			if (!currentConfigRow) return;
			const current = currentConfigRow.config.actions ?? {};
			const merged: UI_RowActions = {
				...current,
				[trigger]: nextTriggerActions,
			};
			dispatchRow({
				type: "UPDATE_ROW_ACTIONS",
				rowId: currentConfigRow.id,
				actions: merged,
			});
		},
		[currentConfigRow, dispatchRow],
	);

	const renderConfiguration = useCallback(
		(configRow: Row): React.ReactNode[] => {
			const merged = mergeRowContentWithPaletteDefaults(configRow);
			const fields = getRowContentFields(configRow.config.type);
			const bindingFields = getRowBindingFields(configRow.config.type);
			const rowSource = configRow.config.source ?? "";

			const scalarFields = fields
				.filter((f) => isPanelScalarField(f.kind))
				.sort(compareRowFieldsForPanel);
			const childFields = fields
				.filter(
					(f) =>
						f.kind === "child" ||
						f.kind === "children" ||
						f.kind === "sheet",
				)
				.sort(compareRowFieldsForPanel);

			const getAttributeCandidatesForQualifier =
				createGetAttributeCandidatesForQualifier({
					serviceResources,
					resourceAttributeMetadata,
					rowSource,
				});

			const contentElements = scalarFields.map((field) => {
				const uniqueId = `${configRow.id}-${field.name}`;
				if (field.kind === "enum") {
					return (
						<ConfigEnumField
							key={uniqueId}
							id={uniqueId}
							label={field.name}
							value={String(merged[field.name] ?? "")}
							options={field.options ?? []}
							onChange={(next) =>
								updateRowContent(field.name, next, configRow.id)
							}
						/>
					);
				}
				return (
					<ConfigTextField
						key={uniqueId}
						id={uniqueId}
						label={field.name}
						value={String(merged[field.name] ?? "")}
						onChange={(next) =>
							updateRowContent(field.name, next, configRow.id)
						}
						candidates={builderAssistCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
					/>
				);
			});

			const containerElements = childFields.flatMap((field) => {
				const uniqueId = `${configRow.id}-${field.name}`;
				let childInfos: ChildInfo[] = [];
				if (field.kind === "child" || field.kind === "sheet") {
					const relationshipId = merged[field.name];
					if (typeof relationshipId === "string") {
						const record = rowsById[relationshipId];
						if (record) {
							childInfos = [
								{
									id: relationshipId,
									name: record.name,
									type: record.type,
								},
							];
						}
					}
				} else if (
					field.kind === "children" &&
					Array.isArray(merged[field.name])
				) {
					childInfos = (merged[field.name] as string[])
						.map((id): ChildInfo | null => {
							const rec = rowsById[id];
							return rec
								? { id, name: rec.name, type: rec.type }
								: null;
						})
						.filter((item): item is ChildInfo => item !== null);
				}

				if (childInfos.length === 0) return [];
				const label =
					field.kind === "child"
						? "Search result"
						: field.kind === "sheet"
							? "Sheet"
							: "Children";

				return [
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
							{childInfos.map(({ id, name, type }) => (
								<ChildRowButton
									key={id}
									name={name}
									type={type}
									onClick={() =>
										openChildConfiguration(id, configRow)
									}
								/>
							))}
						</div>
					</div>,
				];
			});

			const bindingElements = bindingFields.map((field) => {
				const { label, placeholder, ariaLabel } =
					BINDING_FIELD_COPY[field];

				return (
					<ConfigTextField
						key={`${configRow.id}-${field}`}
						id={`${configRow.id}-${field}`}
						label={label}
						value={configRow.config[field] ?? ""}
						onChange={(next) =>
							updateRowRoot(field, next, configRow.id)
						}
						candidates={builderAssistCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
						placeholder={placeholder}
						ariaLabel={ariaLabel}
						labelClassName="evy-text-sm evy-font-medium evy-text-black"
						fieldClassName=""
					/>
				);
			});

			return [
				...contentElements,
				<div
					className="evy-flex evy-flex-col evy-gap-3"
					key={`${configRow.id}-bindings`}
				>
					{bindingElements}
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
		<div
			className="evy-flex evy-flex-col evy-h-full"
			data-testid="config-panel"
		>
			<PageInUseDialog
				references={pageInUseReferences}
				onClose={dismissPageInUseDialog}
			/>
			<div className="evy-p-4 evy-text-xl evy-font-semibold evy-text-center evy-border-b evy-border-gray evy-bg-white">
				{activePage?.name ?? "Configuration"}
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
				{showPageTitleInPanel && activeFlow && (
					<div className="evy-mb-2">
						<span className="evy-text-sm evy-font-medium evy-text-black">
							Flow submits
						</span>
						<p className="evy-text-sm evy-text-gray">
							The entity this flow creates on submit. Leave unset
							for flows that do not submit.
						</p>
						<div className="evy-flex evy-gap-2 evy-mt-1">
							<PopoverSelect
								ariaLabel="Flow submits service"
								value={activeFlow.submits?.service ?? ""}
								placeholder="No service"
								options={submitsServiceOptions}
								onChange={handleSubmitsServiceChange}
							/>
							<PopoverSelect
								ariaLabel="Flow submits resource"
								value={activeFlow.submits?.resource ?? ""}
								placeholder="No resource"
								options={submitsResourceOptions}
								onChange={handleSubmitsResourceChange}
							/>
						</div>
					</div>
				)}
				{showPageTitleInPanel && activePage && currentConfigRow && (
					<div className="evy-border-b evy-border-gray" />
				)}
				{currentConfigRow ? (
					<>
						<div>
							<p className="evy-text-lg evy-font-semibold">
								{currentConfigRow.config.name}
							</p>
							<p className="evy-text-sm evy-text-gray">
								type: {currentConfigRow.config.type}
							</p>
						</div>
						{configurationElements}
						<div className="evy-border-b evy-border-gray" />
						{getRowTriggers(currentConfigRow.config.type).map(
							(triggerSpec) => {
								const triggerActions =
									currentConfigRow.config.actions?.[
										triggerSpec.trigger
									] ?? [];
								return (
									<ActionEditor
										key={`${currentConfigRow.id}-${triggerSpec.trigger}`}
										trigger={triggerSpec.trigger}
										required={triggerSpec.required}
										actions={triggerActions}
										flowsById={flowsById}
										pagesById={pagesById}
										rowsById={rowsById}
										serviceResources={serviceResources}
										defaultSheetRowId={
											currentConfigRow.config.sheetRowId
										}
										onUpdate={(next) =>
											updateRowActionsForTrigger(
												triggerSpec.trigger,
												next,
											)
										}
									/>
								);
							},
						)}
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
