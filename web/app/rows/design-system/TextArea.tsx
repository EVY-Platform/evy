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
			className={`block p-2 w-full text-sm ${border} focus-visible:outline-none resize-none`}
			placeholder={placeholder}
			value={value}
		/>
	);
}
