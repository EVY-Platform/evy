import InlineIcon from "./inline-icon";
import Input from "./input";

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
