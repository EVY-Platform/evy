import type { RowConfig } from "../../types/row";
import EVYText from "../design-system/EVYText";
import { defineRow } from "../defineRow";

function MapPreview() {
	return (
		<img
			src="/map.png"
			alt="Map preview"
			className="evy-block evy-w-full"
			style={{
				aspectRatio: "383/249",
				borderRadius: "var(--radius-md)",
				objectFit: "cover",
			}}
		/>
	);
}

export default defineRow("MapRow", {
	config: {
		type: "Map",
		actions: [],
		source: "",
		destination: "",
		view: {
			content: {
				title: "Map row title",
				location: "{item.transfer_options.pickup.address.location}",
				subtitle: "Map row subtitle",
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const { title, subtitle } = row.config.view.content;
		return (
			<div className="evy-p-2">
				{title ? (
					<p className="evy-text-md evy-mb-2">
						<EVYText text={title} />
					</p>
				) : null}
				<MapPreview />
				{subtitle ? (
					<p className="evy-text-sm evy-text-gray evy-mt-2">
						<EVYText text={subtitle} />
					</p>
				) : null}
			</div>
		);
	},
});
