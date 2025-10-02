export default function Button({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="evy-rounded-sm evy-text-sm evy-px-3 evy-py-3 evy-text-white evy-bg-gray-dark evy-hover\:bg-gray"
		>
			{label}
		</button>
	);
}
