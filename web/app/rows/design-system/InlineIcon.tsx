import iconMap from "../../icons/iconMap";

function resolveIcon(icon: string): string {
	const match = icon.match(/^::([a-zA-Z.]+)::$/);
	if (match) {
		return iconMap[match[1]] ?? icon;
	}
	return icon;
}

export default function InlineIcon({
	icon,
	alt,
	position = "left",
}: {
	icon: string;
	alt: string;
	position?: "left" | "right";
}) {
	const positionClass =
		position === "right" ? "evy-end-0 evy-pe-2" : "evy-start-0 evy-ps-2";
	return (
		<div
			className={`evy-absolute evy-inset-y-0 evy-flex evy-items-center evy-pointer-events-none ${positionClass}`}
		>
			<img className="evy-h-4" src={resolveIcon(icon)} alt={alt} />
		</div>
	);
}
