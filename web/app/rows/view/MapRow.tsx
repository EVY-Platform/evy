import type { RowConfig } from "../../types/row";
import EVYText from "../design-system/EVYText";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

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
		visible: "true",
		destination: "",
		view: {
			content: {
				title: "Map row title",
				location:
					"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.transfer_options.pickup.address.location}",
				subtitle: "Map row subtitle",
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const { title, subtitle } = row.config.view.content;
		return (
			<RowLayout title={title}>
				<MapPreview />
				{subtitle ? (
					<p className="evy-text-sm evy-text-gray evy-mt-2">
						<EVYText text={subtitle} />
					</p>
				) : null}
			</RowLayout>
		);
	},
});
