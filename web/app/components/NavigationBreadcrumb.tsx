import { useContext, useEffect, useMemo, useRef } from "react";

import { PopoverSelect } from "./PopoverSelect";
import { AppContext } from "../state";
import type { Row } from "../types/row";
import { findRowInPages } from "../utils/rowTree";

function breadcrumbLabelForRow(row: Row): string {
	const title = row.config.view.content.title;
	if (typeof title === "string" && title.trim() !== "") {
		return title;
	}
	return row.config.type;
}

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
	gap: var(--spacing-2);
	white-space: nowrap;
	min-height: var(--size-navbar-control);
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
	padding: 0 var(--spacing-2);
	min-height: var(--size-navbar-control);
	max-width: 12rem;
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
`;

export function NavigationBreadcrumb() {
	const {
		flows,
		activeFlowId,
		activePageId,
		activeRowId,
		configStack,
		dispatchRow,
	} = useContext(AppContext);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const activeFlow = flows.find((f) => f.id === activeFlowId);
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
		() => flows.map((f) => ({ value: f.id, label: f.name })),
		[flows],
	);

	const handleRowNavigate = () => {
		dispatchRow({ type: "NAVIGATE_BREADCRUMB", configStackLength: 0 });
	};

	const handleChildNavigate = (stackLength: number) => {
		dispatchRow({
			type: "NAVIGATE_BREADCRUMB",
			configStackLength: stackLength,
		});
	};

	return (
		<>
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
						ariaLabel="Active flow"
						placeholder="Select a flow"
					/>

					{activePage && (
						<>
							<span className="evy-text-gray-dark evy-select-none" aria-hidden>
								&gt;
							</span>
							<button
								type="button"
								className="evy-nav-breadcrumb-link evy-shrink-0"
								aria-label={`Select page ${activePage.title}`}
								onClick={() => {
									dispatchRow({
										type: "SET_ACTIVE_PAGE",
										pageId: activePage.id,
									});
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
								{activePage.title}
							</button>
						</>
					)}

					{activePage && rootRow && (
						<>
							<span className="evy-text-gray-dark evy-select-none" aria-hidden>
								&gt;
							</span>
							<button
								type="button"
								className="evy-nav-breadcrumb-link evy-shrink-0"
								onClick={handleRowNavigate}
								aria-label={`Configure row: ${breadcrumbLabelForRow(rootRow)}`}
							>
								{breadcrumbLabelForRow(rootRow)}
							</button>
						</>
					)}

					{configStack.map((childRowId, index) => {
						const childRow = findRowInPages(childRowId, pages);
						if (!childRow) return null;
						const stackLengthAfterClick = index + 1;
						return (
							<span
								key={childRowId}
								className="evy-inline-flex evy-items-center evy-gap-2 evy-shrink-0"
							>
								<span
									className="evy-text-gray-dark evy-select-none"
									aria-hidden
								>
									&gt;
								</span>
								<button
									type="button"
									className="evy-nav-breadcrumb-link evy-shrink-0"
									onClick={() => handleChildNavigate(stackLengthAfterClick)}
									aria-label={`Configure nested row at depth ${stackLengthAfterClick}: ${breadcrumbLabelForRow(childRow)}`}
								>
									{breadcrumbLabelForRow(childRow)}
								</button>
							</span>
						);
					})}
				</div>
			</div>
		</>
	);
}
