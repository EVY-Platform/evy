import type { DATA_EVY_Page } from "evy-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRowById } from "../hooks/useRowById";
import parseIconText from "../icons/parseIconText";
import { useFlowsContext } from "../state";
import { splitCamelCaseToWords } from "../utils/labelFormatting";
import {
	breadcrumbLabelForPage,
	breadcrumbLabelForRow,
} from "../utils/navLabels";
import { capturePageFramePosition } from "../utils/preActivationCapture";
import { storedRowToRow } from "../utils/rowCodec";
import { CreateFlowDialog } from "./CreateFlowDialog";
import { PopoverSelect } from "./PopoverSelect";

function Separator() {
	return (
		<span className="evy-text-gray-dark evy-select-none" aria-hidden>
			&gt;
		</span>
	);
}

const CREATE_FLOW_OPTION_VALUE = "__evy_create_flow__";

export function NavigationBreadcrumb() {
	const {
		flowsById,
		pagesById,
		rowsById,
		activeFlowId,
		activePageId,
		activeRowId,
		configStack,
		dispatchRow,
	} = useFlowsContext();

	const [createFlowOpen, setCreateFlowOpen] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const activeFlow = activeFlowId ? flowsById[activeFlowId] : undefined;
	const activePage = activePageId ? pagesById[activePageId] : undefined;
	const flowPages = (activeFlow?.pageIds ?? [])
		.map((id) => pagesById[id])
		.filter((p): p is DATA_EVY_Page => Boolean(p));

	const rootRow = useRowById(activeRowId);

	const breadcrumbScrollKey = `${activeFlowId ?? ""}:${activePageId ?? ""}:${activeRowId ?? ""}:${configStack.join(",")}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when any breadcrumb segment changes
	useEffect(() => {
		const element = scrollContainerRef.current;
		if (!element) return;
		element.scrollLeft = element.scrollWidth - element.clientWidth;
	}, [breadcrumbScrollKey]);

	const flowOptions = useMemo(
		() => [
			...Object.values(flowsById).map((f) => ({
				value: f.id,
				label: splitCamelCaseToWords(f.name),
			})),
			{
				value: CREATE_FLOW_OPTION_VALUE,
				label: "Create new flow",
				dividerBefore: true,
				action: true,
			},
		],
		[flowsById],
	);

	const navigateBreadcrumb = (configStackLength: number) => {
		if (activePageId) {
			capturePageFramePosition(activePageId);
		}
		dispatchRow({ type: "NAVIGATE_BREADCRUMB", configStackLength });
	};

	type RowSegment = {
		id: string;
		row: ReturnType<typeof storedRowToRow>;
		stackLength: number;
	};
	const rowSegments: RowSegment[] = [];
	if (activePage && rootRow) {
		rowSegments.push({ id: rootRow.id, row: rootRow, stackLength: 0 });
		for (let i = 0; i < configStack.length; i++) {
			const stackRowId = configStack[i];
			const record = rowsById[stackRowId];
			if (record) {
				rowSegments.push({
					id: stackRowId,
					row: storedRowToRow(record),
					stackLength: i + 1,
				});
			}
		}
	}

	const isPageActiveWithNoRow = !!(activePageId && !activeRowId);

	return (
		<>
			<CreateFlowDialog
				open={createFlowOpen}
				onClose={() => setCreateFlowOpen(false)}
				onCreate={(name) => {
					dispatchRow({ type: "CREATE_FLOW", name });
				}}
			/>
			<div
				ref={scrollContainerRef}
				className="evy-nav-breadcrumb-scroll evy-flex-1 evy-min-w-0 evy-flex evy-justify-center"
				data-testid="nav-breadcrumb-scroll"
			>
				<div className="evy-nav-breadcrumb-inner evy-mx-auto evy-max-w-full evy-px-2">
					<PopoverSelect
						id="flow-select"
						variant="breadcrumb"
						options={flowOptions}
						value={activeFlowId ?? ""}
						onChange={(flowId) => {
							dispatchRow({ type: "SET_ACTIVE_FLOW", flowId });
						}}
						onAction={(flowId) => {
							if (flowId === CREATE_FLOW_OPTION_VALUE) {
								setCreateFlowOpen(true);
							}
						}}
						ariaLabel="Active flow"
						placeholder="Select a flow"
						openOnHover
					/>

					{activePage && (
						<>
							<Separator />
							<button
								type="button"
								className={`evy-nav-breadcrumb-link evy-shrink-0${isPageActiveWithNoRow ? " evy-nav-breadcrumb-link--active" : ""}`}
								aria-current={
									isPageActiveWithNoRow ? "page" : undefined
								}
								aria-label={`Select page ${breadcrumbLabelForPage(activePage, flowPages)}`}
								onClick={() => {
									capturePageFramePosition(activePage.id);
									dispatchRow({
										type: "SET_ACTIVE_PAGE",
										pageId: activePage.id,
									});
								}}
							>
								{breadcrumbLabelForPage(activePage, flowPages)}
							</button>
						</>
					)}

					{rowSegments.map(({ id, row, stackLength }) => {
						const label = breadcrumbLabelForRow(row);
						const ariaLabel =
							stackLength === 0
								? `Configure row: ${label}`
								: `Configure nested row at depth ${stackLength}: ${label}`;
						return (
							<span
								key={id}
								className="evy-inline-flex evy-items-center evy-gap-2 evy-shrink-0"
							>
								<Separator />
								<button
									type="button"
									className="evy-nav-breadcrumb-link evy-shrink-0"
									onClick={() =>
										navigateBreadcrumb(stackLength)
									}
									aria-label={ariaLabel}
								>
									{parseIconText(label)}
								</button>
							</span>
						);
					})}
				</div>
			</div>
		</>
	);
}
