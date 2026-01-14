import { DraggableRowContainer } from "./DraggableRowContainer";
import { containerDropindicatorId } from "../rows/EVYRow";
import {
	verticalDropIndicator,
	dropIndicatorExpansionBefore,
} from "../rows/design-system/dropIndicator";

export function PlaceholderDropIndicator() {
	return (
		<DraggableRowContainer
			key={containerDropindicatorId}
			rowId={containerDropindicatorId}
			orientation="horizontal"
		>
			<div
				className={`${verticalDropIndicator} ${dropIndicatorExpansionBefore}`}
			/>
		</DraggableRowContainer>
	);
}
