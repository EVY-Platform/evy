import type { UI_RowActions } from "evy-types";
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

type DefaultRowActionsInput = {
	tap?: string;
	delete?: string;
	"tap-row"?: string;
	"tap-column"?: string;
};

export function defaultRowActions(
	options: DefaultRowActionsInput,
): UI_RowActions {
	const actions: UI_RowActions = {};
	if (options.tap !== undefined) {
		actions.tap = [rowAction(options.tap)];
	}
	if (options.delete !== undefined) {
		actions.delete = [rowAction(options.delete)];
	}
	if (options["tap-row"] !== undefined) {
		actions["tap-row"] = [rowAction(options["tap-row"])];
	}
	if (options["tap-column"] !== undefined) {
		actions["tap-column"] = [rowAction(options["tap-column"])];
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
