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
		offset === "left" ? "pl-8" : offset === "right" ? "pr-8" : "";
	return (
		<input
			type="text"
			className={`w-full text-sm ${border} focus-visible:outline-none ${offsetClass}`}
			required
			value={value}
			placeholder={placeholder}
		/>
	);
}
