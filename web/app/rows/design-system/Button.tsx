export default function Button({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="evy-rounded-md evy-text-sm evy-px-3 evy-py-3 evy-border-none evy-text-white evy-bg-gray-dark evy-hover:bg-gray"
		>
			{label}
		</button>
	);
}
