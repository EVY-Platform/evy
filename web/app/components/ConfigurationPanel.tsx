import { useCallback, useContext, useMemo, useState } from "react";

import { AppContext } from "../state";
import type { Row } from "../types/row";
import type { SDUI_Flow } from "../types/flow";
import { useRowById } from "../hooks/useRowById";

const ACTION_TYPES = ["navigate", "submit", "close"] as const;
type ActionType = (typeof ACTION_TYPES)[number];

function parseActionType(value: string): ActionType | undefined {
	for (const t of ACTION_TYPES) {
		if (value === t || value.startsWith(`${t}:`)) return t;
	}
	return undefined;
}

function FriendlyInput({
	id,
	label,
	rawValue,
	displayValue,
	onChange,
}: {
	id: string;
	label: string;
	rawValue: string;
	displayValue: string;
	onChange: (newValue: string) => void;
}) {
	const [isFocused, setIsFocused] = useState(false);
	return (
		<div className="evy-mb-2">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="text"
				value={isFocused ? rawValue : displayValue}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				onChange={(e) => onChange(e.target.value)}
				className="evy-w-full evy-focus-visible:outline-none"
			/>
		</div>
	);
}

function ActionTargetSection({
	value,
	flows,
	onChange,
}: {
	value: string;
	flows: SDUI_Flow[];
	onChange: (newValue: string) => void;
}) {
	const selected = parseActionType(value);
	const parts = value.split(":");
	const flowId = parts[1] ?? "";
	const pageId = parts[2] ?? "";

	const flow = flows.find((f) => f.id === flowId);
	const flowDisplayName = flow?.name ?? flowId;
	const pageDisplayTitle =
		flow?.pages.find((p) => p.id === pageId)?.title ?? pageId;

	return (
		<>
			<div className="evy-rounded-full evy-flex evy-mb-2">
				{ACTION_TYPES.map((actionType, index) => (
					<button
						key={actionType}
						type="button"
						onClick={() => {
							if (actionType === "navigate") {
								onChange(`navigate:${flowId}:${pageId}`);
							} else {
								onChange(actionType);
							}
						}}
						className={`evy-flex-1 evy-border ${
							index === 0 ? "evy-rounded-left-md evy-border-r-0" : ""
						} ${
							index === ACTION_TYPES.length - 1
								? "evy-rounded-right-md evy-border-l-0"
								: ""
						} ${selected === actionType ? "evy-bg-gray-light" : "evy-bg-white"}`}
					>
						{actionType.charAt(0).toUpperCase() + actionType.slice(1)}
					</button>
				))}
			</div>
			{selected === "navigate" && (
				<>
					<FriendlyInput
						id="action-flow"
						label="flow"
						rawValue={flowId}
						displayValue={flowDisplayName}
						onChange={(newFlowId) =>
							onChange(`navigate:${newFlowId}:${pageId}`)
						}
					/>
					<FriendlyInput
						id="action-page"
						label="page"
						rawValue={pageId}
						displayValue={pageDisplayTitle}
						onChange={(newPageId) =>
							onChange(`navigate:${flowId}:${newPageId}`)
						}
					/>
				</>
			)}
		</>
	);
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
					<>
						{configurationElements}
						<div className="evy-border-b evy-border-gray" />
						<div>
							<div className="evy-flex evy-items-center evy-justify-between evy-mb-4">
								<p className="evy-text-lg evy-font-semibold">Action</p>
								<button
									type="button"
									className="evy-text-sm evy-text-black evy-cursor-pointer evy-bg-transparent evy-border-none evy-hover:bg-gray-light evy-rounded-sm"
									onClick={() => {
										if (!row) return;
										dispatchRow({
											type: "REMOVE_ROW_ACTION",
											rowId: row.id,
										});
									}}
								>
									Remove
								</button>
							</div>
							<ActionTargetSection
								value={row?.config.action?.target ?? ""}
								flows={flows}
								onChange={(newValue) => {
									if (!row) return;
									dispatchRow({
										type: "UPDATE_ROW_ACTION",
										rowId: row.id,
										target: newValue,
									});
								}}
							/>
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
