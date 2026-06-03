import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import CarouselIndicator from "../design-system/CarouselIndicator";

export default defineRow("PhotoGalleryRow", {
	config: {
		type: "PhotoGallery",
		actions: [],
		source: "{item.photo_ids}",
		view: {
			content: {
				title: "Photo gallery row title",
			},
		},
		destination: "",
	} satisfies RowConfig,
	render: (row) => (
		<div>
			<div className="evy-p-2">
				<p className="evy-text-md">
					<EVYText text={row.config.view.content.title} />
				</p>
			</div>
			<div
				className="evy-relative evy-w-full evy-bg-gray-light evy-overflow-hidden evy-flex evy-items-center evy-justify-center"
				style={{ aspectRatio: "4/3" }}
			>
				<img
					src="/logo.svg"
					alt="gallery placeholder"
					className="evy-pointer-events-none"
					style={{ width: "60%", height: "60%", objectFit: "contain" }}
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
		</div>
	),
});
