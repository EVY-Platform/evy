import { useMemo } from "react";

import type { ServiceResource } from "../../types/resources";
import {
	resourceOptionsForService,
	serviceOfSubmitsRef,
	serviceOptionsFor,
} from "../../utils/flowSubmitOptions";
import { PopoverSelect } from "../PopoverSelect";

type FlowSubmitsPickerProps = {
	serviceId: string;
	resourceRef: string;
	serviceResources: ServiceResource[];
	serviceNamesById: Map<string, string>;
	onChange: (next: { serviceId: string; resourceRef: string }) => void;
};

export function FlowSubmitsPicker({
	serviceId,
	resourceRef,
	serviceResources,
	serviceNamesById,
	onChange,
}: FlowSubmitsPickerProps) {
	const serviceOptions = useMemo(
		() => [
			{ value: "", label: "None" },
			...serviceOptionsFor(serviceResources, serviceNamesById),
		],
		[serviceResources, serviceNamesById],
	);

	const resourceOptions = useMemo(
		() => resourceOptionsForService(serviceResources, serviceId),
		[serviceResources, serviceId],
	);

	return (
		<>
			<PopoverSelect
				ariaLabel="Flow submits service"
				value={serviceId}
				options={serviceOptions}
				onChange={(nextServiceId) => {
					if (nextServiceId === "") {
						onChange({ serviceId: "", resourceRef: "" });
						return;
					}
					const currentService = serviceOfSubmitsRef(resourceRef);
					onChange({
						serviceId: nextServiceId,
						resourceRef:
							currentService === nextServiceId ? resourceRef : "",
					});
				}}
			/>
			{serviceId !== "" && (
				<PopoverSelect
					ariaLabel="Flow submits resource"
					value={resourceRef}
					options={resourceOptions}
					onChange={(nextResourceRef) => {
						onChange({
							serviceId,
							resourceRef: nextResourceRef,
						});
					}}
				/>
			)}
		</>
	);
}
