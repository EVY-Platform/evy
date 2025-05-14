import React, { ReactNode } from "react";

export type RowConfig = {
	id: string;
	type: string;
	value: string;
}[];

export abstract class EVYRow extends React.Component<{
	rowId: string;
}> {
	static config: RowConfig;

	abstract renderContent(): ReactNode;

	render() {
		return this.renderContent();
	}
}
