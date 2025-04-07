import { memo } from "react";

import { RowConfig } from "./row";

export const ConfigurationPanel = memo(function ConfigurationPanel({
	configuration,
}: {
	configuration: RowConfig | undefined;
}) {
	return (
		<div className="flex flex-col">
			<div className="p-4 text-xl font-bold text-center">
				Configuration
			</div>
			<div className="flex flex-col min-h-full p-2 gap-2 overflow-scroll">
				{configuration?.map((c) => {
					if (c.type === "text") {
						return (
							<form className="grid" key={c.id}>
								<label htmlFor={c.id}>{c.id}</label>
								<input
									id={c.id}
									type="text"
									className="w-full text-sm rounded p-2 border border-opacity-50 focus-visible:outline-none"
									required
								>
									{c.value}
								</input>
							</form>
						);
					} else {
						return <div key={c.id}>{c.type}</div>;
					}
				})}
			</div>
		</div>
	);
});
