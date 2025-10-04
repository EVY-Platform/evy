import { useContext } from "react";
import { AppContext } from "../registry";

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
		<div className="evy-flex">
			<select
				id="flow-select"
				value={activeFlowId || "Select a flow"}
				onChange={handleFlowChange}
				className="evy-text-sm evy-rounded evy-p-2 evy-border-gray"
			>
				{flows.map((flow) => (
					<option key={flow.id} value={flow.id}>
						{flow.name}
					</option>
				))}
			</select>
		</div>
	);
}
