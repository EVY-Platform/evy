import { border } from "./border";

export default function Input({
	value,
	placeholder,
	offset = "none",
}: {
	value: string;
	placeholder: string;
	offset?: "none" | "left" | "right";
}) {
	const offsetClass =
		offset === "left" ? "evy-pl-8" : offset === "right" ? "evy-pr-8" : "";
	return (
		<input
			type="text"
			className={`evy-w-full evy-box-sizing-border evy-text-sm ${border} evy-focus-visible:outline-none ${offsetClass}`}
			required
			value={value}
			placeholder={placeholder}
			readOnly
		/>
	);
}
