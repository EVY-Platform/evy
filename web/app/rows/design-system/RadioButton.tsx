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
			className={`evy-rounded-md evy-text-sm evy-px-3 evy-py-3 evy-border-none ${
				selected
					? "evy-bg-gray-light evy-text-black evy-hover:bg-gray"
					: "evy-bg-gray-dark evy-text-white evy-hover:bg-gray"
			}`}
		>
			{label}
		</button>
	);
}
