import { useParseText } from "../../hooks/useParseText";

export default function Button({
	label,
	style,
}: {
	label?: string;
	style?: string;
}) {
	const parseText = useParseText();
	const isDanger = style === "danger";
	const backgroundClass = isDanger
		? "evy-bg-red evy-hover:bg-red"
		: "evy-bg-gray-dark evy-hover:bg-gray";

	return (
		<button
			type="button"
			className={`evy-rounded-md evy-text-sm evy-px-4 evy-py-2 evy-border-none evy-text-white ${backgroundClass}`}
		>
			{parseText(label ?? "")}
		</button>
	);
}
