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
					? "bg-evy-gray-light text-black"
					: "bg-evy-gray text-white"
			}`}
		>
			{label}
		</button>
	);
}
