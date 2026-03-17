import iconMap from "../../icons/iconMap";

const ICON_SYNTAX_REGEX = /^::(.+)::$/;

function resolveIconSrc(icon: string): string {
	const match = icon.match(ICON_SYNTAX_REGEX);
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
			className={`evy-absolute evy-inset-y-0 ${positionClass} evy-flex evy-items-center evy-pointer-events-none`}
		>
			<img className="evy-h-4" src={resolveIconSrc(icon)} alt={alt} />
		</div>
	);
}
