import InlineIcon from "./InlineIcon";
import Input from "./Input";

export default function Dropdown({
	value,
	placeholder,
}: {
	value: string;
	placeholder: string;
}) {
	return (
		<div className="evy-relative">
			<Input value={value} placeholder={placeholder} />
			<InlineIcon icon="::chevron-down::" alt="Select" position="right" />
		</div>
	);
}
