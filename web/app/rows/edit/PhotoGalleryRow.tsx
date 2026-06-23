import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import CarouselIndicator from "../design-system/CarouselIndicator";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("PhotoGalleryRow", {
	config: {
		type: "PhotoGallery",
		actions: [],
		source: `{${MARKETPLACE_RESOURCE.ITEMS}.photo_ids}`,
		visible: "true",
		view: {
			content: {
				title: "Photo gallery row title",
			},
		},
		destination: "",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title} fullWidthContent>
			<div
				className="evy-relative evy-w-full evy-bg-gray-light evy-overflow-hidden evy-flex evy-items-center evy-justify-center"
				style={{ aspectRatio: "4/3" }}
			>
				<img
					src="/logo.svg"
					alt="gallery placeholder"
					className="evy-pointer-events-none"
					style={{
						width: "60%",
						height: "60%",
						objectFit: "contain",
					}}
				/>
				<div
					className="evy-absolute evy-pointer-events-none"
					style={{ bottom: 0, left: 0, right: 0 }}
				>
					<CarouselIndicator
						pageCount={3}
						activeIndex={0}
						color="var(--color-white)"
						inactiveColor="rgba(255, 255, 255, 0.45)"
					/>
				</div>
			</div>
		</RowLayout>
	),
});
