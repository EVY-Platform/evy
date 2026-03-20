import { useEffect, useMemo, useRef, useState } from "react";

import parseIconText from "../icons/parseIconText";
import { CreateFlowDialog } from "./CreateFlowDialog";
import { PopoverSelect } from "./PopoverSelect";
import { useFlowsContext } from "../state";
import type { Row } from "../types/row";
import {
	breadcrumbLabelForPage,
	breadcrumbLabelForRow,
} from "../utils/navLabels";
import { findFlowById } from "../utils/flowHelpers";
import { splitCamelCaseToWords } from "../utils/labelFormatting";
import { findRowInPages } from "../utils/rowTree";

const breadcrumbScrollCss = `
.evy-nav-breadcrumb-scroll {
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
	-ms-overflow-style: none;
}
.evy-nav-breadcrumb-scroll::-webkit-scrollbar {
	display: none;
}
.evy-nav-breadcrumb-inner {
	display: inline-flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: center;
	gap: var(--size-2);
	white-space: nowrap;
	min-height: var(--size-nav-control);
}
.evy-nav-breadcrumb-inner .evy-nav-breadcrumb-link {
	font-size: var(--text-sm);
	font-weight: var(--font-semibold);
	line-height: 1.5;
	color: var(--color-evy-blue);
	background: transparent;
	border: none;
	border-radius: var(--radius-sm);
	cursor: pointer;
	padding: 0 var(--size-2);
	min-height: var(--size-nav-control);
	max-width: var(--size-48);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.evy-nav-breadcrumb-inner .evy-nav-breadcrumb-link:hover {
	text-decoration: underline;
}
.evy-nav-breadcrumb-inner .evy-nav-breadcrumb-link:focus-visible {
	outline: 2px solid var(--color-evy-blue);
	outline-offset: 2px;
}
@keyframes evy-breadcrumb-page-text-glow {
	0%, 100% {
		text-shadow: 0 0 1px oklch(60.04% 0.2013 261.37 / 0.1);
	}
	50% {
		text-shadow: 0 0 12px oklch(60.04% 0.2013 261.37 / 1);
	}
}
.evy-nav-breadcrumb-inner .evy-nav-breadcrumb-link--focus-page {
	animation: evy-breadcrumb-page-text-glow 1s ease-in-out infinite;
}
`;

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
		flows,
		activeFlowId,
		activePageId,
		activeRowId,
		configStack,
		focusMode,
		dispatchRow,
	} = useFlowsContext();

	const [createFlowOpen, setCreateFlowOpen] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const activeFlow = findFlowById(flows, activeFlowId);
	const activePage = activeFlow?.pages.find((p) => p.id === activePageId);
	const pages = activeFlow?.pages ?? [];

	const rootRow =
		activeRowId && pages.length > 0
			? findRowInPages(activeRowId, pages)
			: undefined;

	const breadcrumbScrollKey = `${activeFlowId ?? ""}:${activePageId ?? ""}:${activeRowId ?? ""}:${configStack.join(",")}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when any breadcrumb segment changes
	useEffect(() => {
		const element = scrollContainerRef.current;
		if (!element) return;
		element.scrollLeft = element.scrollWidth - element.clientWidth;
	}, [breadcrumbScrollKey]);

	const flowOptions = useMemo(
		() => [
			...flows.map((f) => ({
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
		[flows],
	);

	const navigateBreadcrumb = (configStackLength: number) => {
		dispatchRow({ type: "NAVIGATE_BREADCRUMB", configStackLength });
	};

	const rowSegments: Array<{ id: string; row: Row; stackLength: number }> = [];
	if (activePage && rootRow) {
		rowSegments.push({ id: rootRow.id, row: rootRow, stackLength: 0 });
		for (let i = 0; i < configStack.length; i++) {
			const childRow = findRowInPages(configStack[i], pages);
			if (childRow) {
				rowSegments.push({
					id: configStack[i],
					row: childRow,
					stackLength: i + 1,
				});
			}
		}
	}

	return (
		<>
			<CreateFlowDialog
				open={createFlowOpen}
				onClose={() => setCreateFlowOpen(false)}
				onCreate={(name) => {
					dispatchRow({ type: "CREATE_FLOW", name });
				}}
			/>
			<style>{breadcrumbScrollCss}</style>
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
								className={`evy-nav-breadcrumb-link evy-shrink-0${focusMode ? " evy-nav-breadcrumb-link--focus-page" : ""}`}
								aria-current={focusMode ? "page" : undefined}
								aria-label={`Select page ${breadcrumbLabelForPage(activePage, pages)}`}
								onClick={() => {
									dispatchRow({ type: "TOGGLE_FOCUS_MODE" });
								}}
								onDoubleClick={(e) => {
									e.preventDefault();
									const nextTitle = window.prompt(
										"Page title",
										activePage.title,
									);
									if (nextTitle !== null) {
										dispatchRow({
											type: "UPDATE_PAGE_TITLE",
											pageId: activePage.id,
											title: nextTitle,
										});
									}
								}}
							>
								{breadcrumbLabelForPage(activePage, pages)}
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
									onClick={() => navigateBreadcrumb(stackLength)}
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
