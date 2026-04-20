import { parseText } from "../../utils/interpreter";
import { border } from "./border";

export default function TextArea({
	placeholder,
	value,
}: {
	placeholder: string;
	value: string;
}) {
	return (
		<textarea
			id="message"
			rows={4}
			className={`evy-block evy-box-sizing-border evy-p-2 evy-w-full evy-text-sm ${border} evy-focus-visible:outline-none`}
			style={{ resize: "none" }}
			placeholder={parseText(placeholder)}
			value={parseText(value)}
			readOnly
		/>
	);
}
