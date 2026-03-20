import type { CSSProperties } from "react";
import parseIconText from "../../icons/parseIconText";
import { parseText } from "../../utils/evyInterpreter";
import { border } from "./border";

const placeholderBase: CSSProperties = {
	paddingLeft: "var(--size-2)",
	color: "var(--color-evy-gray)",
	columnGap: "var(--size-1)",
};

export default function Input({
	value,
	placeholder,
}: {
	value: string;
	placeholder: string;
}) {
	const resolved = parseText(value);
	const parsedPlaceholder = parseText(placeholder);

	return (
		<div className="evy-relative">
			<input
				type="text"
				className={`evy-w-full evy-box-sizing-border evy-text-sm ${border} evy-focus-visible:outline-none`}
				required
				value={resolved}
				readOnly
			/>
			{!resolved && (
				<span
					className="evy-absolute evy-inset-y-0 evy-flex evy-items-center evy-text-sm evy-pointer-events-none"
					style={placeholderBase}
				>
					{parseIconText(parsedPlaceholder)}
				</span>
			)}
		</div>
	);
}
