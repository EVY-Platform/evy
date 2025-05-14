export default function Button({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="rounded-sm text-sm px-3 py-3 text-white bg-evy-gray hover:bg-black"
		>
			{label}
		</button>
	);
}
