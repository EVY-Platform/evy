import { border } from "./border";

export default function Checkbox({ checked }: { checked: boolean }) {
	return (
		<input
			id="checkbox"
			type="checkbox"
			checked={checked}
			className={`w-4 h-4 bg-gray ${border}`}
			readOnly
		/>
	);
}
