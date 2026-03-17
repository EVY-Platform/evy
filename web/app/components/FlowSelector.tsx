import { useContext } from "react";
import { AppContext } from "../state";

export function FlowSelector() {
	const { flows, activeFlowId, dispatchRow } = useContext(AppContext);

	const handleFlowChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const newFlowId = event.target.value;
		dispatchRow({
			type: "SET_ACTIVE_FLOW",
			flowId: newFlowId,
		});
	};

	return (
		<select
			id="flow-select"
			value={activeFlowId || "Select a flow"}
			onChange={handleFlowChange}
			className="evy-text-sm evy-font-medium evy-p-2"
			style={{ paddingRight: "calc(var(--spacing-8) + var(--spacing-4))" }}
		>
			{flows.map((flow) => (
				<option key={flow.id} value={flow.id}>
					{flow.name}
				</option>
			))}
		</select>
	);
}
