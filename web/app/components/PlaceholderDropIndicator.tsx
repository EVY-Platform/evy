import { DraggableRowContainer } from "./DraggableRowContainer";
import { containerDropindicatorId } from "../rows/EVYRow";
import {
	verticalDropIndicator,
	dropIndicatorExpansionBefore,
} from "../rows/design-system/dropIndicator";

export function PlaceholderDropIndicator() {
	return (
		<DraggableRowContainer
			rowId={containerDropindicatorId}
			orientation="horizontal"
			isDraggable={false}
		>
			<div
				className={`${verticalDropIndicator} ${dropIndicatorExpansionBefore}`}
			/>
		</DraggableRowContainer>
	);
}
