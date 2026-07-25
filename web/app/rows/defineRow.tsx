import type { RowTriggerName, UI_ActionBranch, UI_RowActions } from "evy-types";
import { createElement, type ReactNode } from "react";

import { useRowById } from "../hooks/useRowById";
import type { Row, RowConfig } from "../types/row";
import { rowAction } from "../utils/rowActions";
import { RowLayout } from "./design-system/RowLayout";

type RowDefinition =
	| { config: RowConfig; render: (row: Row) => ReactNode }
	| {
			config: RowConfig;
			Component: (props: { rowId: string }) => ReactNode;
	  };

type RowComponent = ((props: { rowId: string }) => ReactNode) & {
	config: RowConfig;
	name: string;
};

/**
 * Palette defaults are storage-shaped, like everything the builder saves. The
 * editor's text form only exists inside the action editor.
 */
type DefaultRowActionsInput = Partial<Record<RowTriggerName, UI_ActionBranch>>;

export function defaultRowActions(
	options: DefaultRowActionsInput,
): UI_RowActions {
	const actions: UI_RowActions = {};
	for (const [trigger, branch] of Object.entries(options) as [
		RowTriggerName,
		UI_ActionBranch | undefined,
	][]) {
		if (branch !== undefined) {
			actions[trigger] = [rowAction(branch)];
		}
	}
	return actions;
}

function UnknownRowContent(): ReactNode {
	return (
		<RowLayout title="Unknown row">
			<p className="evy-text-sm">Row not found</p>
		</RowLayout>
	);
}

/**
 * Row components are not wrapped in `React.memo` here: doing so caused newly
 * dropped rows (palette → page) to skip rendering in tests; FlowsContext split
 * already limits re-renders during drag.
 */
export function defineRow(
	typeName: string,
	definition: RowDefinition,
): RowComponent {
	const { config } = definition;

	let innerFn: (props: { rowId: string }) => ReactNode;

	if ("Component" in definition && definition.Component) {
		const Comp = definition.Component;
		innerFn = function InnerWithComponent({ rowId }: { rowId: string }) {
			return createElement(Comp, { rowId });
		};
	} else if ("render" in definition) {
		const render = definition.render;
		innerFn = function InnerWithRender({ rowId }: { rowId: string }) {
			const row = useRowById(rowId);
			if (!row) {
				return <UnknownRowContent />;
			}
			return render(row);
		};
	} else {
		innerFn = () => <UnknownRowContent />;
	}

	const RowComponentImpl = innerFn as RowComponent;
	RowComponentImpl.config = config;
	Object.defineProperty(RowComponentImpl, "name", { value: typeName });

	return RowComponentImpl;
}
