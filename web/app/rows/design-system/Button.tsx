export default function Button({ label }: { label: string }) {
	return (
		<button
			type="button"
			className="rounded-sm text-sm px-3 py-3 text-white bg-gray-dark hover:bg-gray"
		>
			{label}
		</button>
	);
}
