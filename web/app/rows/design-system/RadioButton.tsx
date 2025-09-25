export default function RadioButton({
	label,
	selected,
}: {
	label: string;
	selected: boolean;
}) {
	return (
		<button
			type="button"
			className={`rounded-md text-sm px-3 py-3 ${
				selected
					? "bg-gray-light text-black hover:bg-gray"
					: "bg-gray-dark text-white hover:bg-gray"
			}`}
		>
			{label}
		</button>
	);
}
