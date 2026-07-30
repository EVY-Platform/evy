import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
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
		type: "map",
		actions: {},
		source: "{findFirst(addresses, resourceId.transfer_options.pickup.address_id)}",
		visible: "true",
		title: "Map row title",
		subtitle: "Map row subtitle",
	} satisfies RowConfig,
	render: (row) => {
		const { title, subtitle } = row.config;
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
