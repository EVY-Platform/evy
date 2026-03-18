import { border } from "./border";

export default function Checkbox({ checked }: { checked: boolean }) {
	return (
		<input
			id="checkbox"
			type="checkbox"
			checked={checked}
			className={`evy-w-4 evy-h-4 ${border}`}
			readOnly
		/>
	);
}
