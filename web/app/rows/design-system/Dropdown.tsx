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
		<div className="relative">
			<Input value={value} placeholder={placeholder} offset="left" />
			<InlineIcon icon="/arrow_down.svg" alt="Select" />
		</div>
	);
}
