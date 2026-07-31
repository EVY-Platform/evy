import { Settings } from "lucide-react";
import { useState } from "react";

import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import { FlowSettingsModal } from "./flowSettings/FlowSettingsModal";

export function FlowSettingsButton() {
	const { activeFlowId } = useFlowsContext();
	const [open, setOpen] = useState(false);

	if (!activeFlowId) return null;

	return (
		<>
			<button
				type="button"
				className="evy-nav-gear-button evy-shrink-0"
				aria-label="Flow settings"
				onClick={() => setOpen(true)}
			>
				<Settings size={16} strokeWidth={LUCIDE_STROKE_WIDTH} />
			</button>
			{open && (
				<FlowSettingsModal mode="edit" onClose={() => setOpen(false)} />
			)}
		</>
	);
}
