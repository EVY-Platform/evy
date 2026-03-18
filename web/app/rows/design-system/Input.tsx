import type { CSSProperties } from "react";
import { parseText } from "../../utils/evyInterpreter";
import { border } from "./border";

const offsetStyles: Record<string, CSSProperties> = {
	left: { paddingLeft: "var(--spacing-8)" },
	right: { paddingRight: "var(--spacing-8)" },
};

export default function Input({
	value,
	placeholder,
	offset = "none",
}: {
	value: string;
	placeholder: string;
	offset?: "none" | "left" | "right";
}) {
	return (
		<input
			type="text"
			className={`evy-w-full evy-box-sizing-border evy-text-sm ${border} evy-focus-visible:outline-none`}
			style={offsetStyles[offset]}
			required
			value={parseText(value)}
			placeholder={parseText(placeholder)}
			readOnly
		/>
	);
}
