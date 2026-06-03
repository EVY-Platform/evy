export default function CarouselIndicator({
	pageCount,
	activeIndex = 0,
	color = "var(--color-black)",
	inactiveColor = "rgba(0, 0, 0, 0.2)",
}: {
	pageCount: number;
	activeIndex?: number;
	color?: string;
	inactiveColor?: string;
}) {
	if (pageCount <= 1) return null;

	const pageNumbers = Array.from({ length: pageCount }, (_, index) => index);

	return (
		<div
			className="evy-flex evy-justify-center evy-items-center evy-pointer-events-none"
			style={{ gap: 8, padding: 8 }}
		>
			{pageNumbers.map((pageNumber) => (
				<div
					key={`page-${pageNumber}`}
					style={{
						width: 28,
						height: 6,
						borderRadius: 999,
						backgroundColor: pageNumber === activeIndex ? color : inactiveColor,
						flexShrink: 0,
					}}
				/>
			))}
		</div>
	);
}
