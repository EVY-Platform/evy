import { createElement, type ReactNode } from "react";

import { useRowById } from "../hooks/useRowById";
import type { Row, RowConfig } from "../types/row";
import { RowLayout } from "./design-system/RowLayout";

export type RowDefinition =
	| { config: RowConfig; render: (row: Row) => ReactNode }
	| {
			config: RowConfig;
			Component: (props: { rowId: string }) => ReactNode;
	  };

export type RowComponent = ((props: { rowId: string }) => ReactNode) & {
	config: RowConfig;
	name: string;
};

function UnknownRowContent(): ReactNode {
	return (
		<RowLayout title="Unknown row">
			<p className="evy-text-sm">Row not found</p>
		</RowLayout>
	);
}

export function defineRow(
	typeName: string,
	definition: RowDefinition,
): RowComponent {
	const { config } = definition;

	let RowComponentImpl: (props: { rowId: string }) => ReactNode;

	if ("Component" in definition && definition.Component) {
		const Comp = definition.Component;
		RowComponentImpl = function InnerWithComponent({
			rowId,
		}: {
			rowId: string;
		}) {
			return createElement(Comp, { rowId });
		};
	} else {
		RowComponentImpl = function InnerWithRender({ rowId }: { rowId: string }) {
			const row = useRowById(rowId);
			if (!row) {
				return <UnknownRowContent />;
			}
			return definition.render(row);
		};
	}

	RowComponentImpl.displayName = typeName;
	RowComponentImpl.config = config;
	Object.defineProperty(RowComponentImpl, "name", { value: typeName });

	return RowComponentImpl as RowComponent;
}
