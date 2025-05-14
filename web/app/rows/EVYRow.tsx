import React, { ReactNode } from "react";
import { RowConfig } from "@/app/components/DraggableRowContainer";

export abstract class EVYRow extends React.Component<{
	rowId: string;
}> {
	static config: RowConfig;

	abstract renderContent(): ReactNode;

	render() {
		return this.renderContent();
	}
}
