import { useCallback, useContext, useMemo, useState } from "react";
import type { SDUI_RowAction } from "evy-types/sdui/evy";

import { AppContext } from "../state";
import type { Row } from "../types/row";
import { useRowById } from "../hooks/useRowById";

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

function ActionItemSection({
	actionItem,
	index,
	onChange,
	onRemove,
}: {
	actionItem: SDUI_RowAction;
	index: number;
	onChange: (index: number, key: keyof SDUI_RowAction, value: string) => void;
	onRemove: (index: number) => void;
}) {
	return (
		<div className="evy-mb-4">
			<div className="evy-flex evy-items-center evy-justify-between evy-mb-2">
				<p className="evy-text-sm evy-font-semibold">Action {index + 1}</p>
				<button
					type="button"
					onClick={() => onRemove(index)}
					className="evy-text-sm evy-bg-transparent evy-border-none evy-rounded-sm evy-cursor-pointer evy-hover:bg-gray-light"
				>
					Remove
				</button>
			</div>
			<FriendlyInput
				id={`condition-${index}`}
				label="When"
				rawValue={actionItem.condition}
				displayValue={actionItem.condition}
				onChange={(newValue) => onChange(index, "condition", newValue)}
			/>
			<FriendlyInput
				id={`true-${index}`}
				label="Then"
				rawValue={actionItem.true}
				displayValue={actionItem.true}
				onChange={(newValue) => onChange(index, "true", newValue)}
			/>
			<FriendlyInput
				id={`false-${index}`}
				label="Otherwise"
				rawValue={actionItem.false}
				displayValue={actionItem.false}
				onChange={(newValue) => onChange(index, "false", newValue)}
			/>
		</div>
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
							<p className="evy-text-lg evy-font-semibold evy-mb-4">Actions</p>
							{row && row.config.actions.length > 0 ? (
								row.config.actions.map((actionItem, index) => (
									<ActionItemSection
										key={`${row.id}-action-${index}`}
										actionItem={actionItem}
										index={index}
										onChange={(actionIndex, key, value) => {
											if (!row) return;
											const actions = [...row.config.actions];
											const existingAction = actions[actionIndex];
											if (!existingAction) return;
											actions[actionIndex] = {
												...existingAction,
												[key]: value,
											};
											dispatchRow({
												type: "UPDATE_ROW_ACTIONS",
												rowId: row.id,
												actions,
											});
										}}
										onRemove={(actionIndex) => {
											if (!row) return;
											const actions = row.config.actions.filter(
												(_, index) => index !== actionIndex,
											);
											if (actions.length === 0) {
												dispatchRow({
													type: "REMOVE_ROW_ACTION",
													rowId: row.id,
												});
												return;
											}
											dispatchRow({
												type: "UPDATE_ROW_ACTIONS",
												rowId: row.id,
												actions,
											});
										}}
									/>
								))
							) : (
								<p className="evy-text-sm evy-text-gray evy-mb-3">
									Row has no actions
								</p>
							)}
							<button
								type="button"
								onClick={() => {
									if (!row) return;
									dispatchRow({
										type: "UPDATE_ROW_ACTIONS",
										rowId: row.id,
										actions: [
											...row.config.actions,
											{ condition: "", false: "", true: "" },
										],
									});
								}}
								className="evy-w-full evy-mt-4 evy-text-sm evy-bg-transparent evy-border evy-border-gray evy-rounded-sm evy-px-2 evy-py-1 evy-cursor-pointer evy-hover:bg-gray-light"
							>
								Add action
							</button>
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
