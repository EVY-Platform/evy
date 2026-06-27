import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
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
		type: "Map",
		actions: [],
		source: "",
		visible: "true",
		destination: "",
		title: "Map row title",
		location: `{${MARKETPLACE_RESOURCE.ITEMS}.transfer_options.pickup.address.location}`,
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
