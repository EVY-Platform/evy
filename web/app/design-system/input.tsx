export default function Input({ placeholder }: { placeholder: string }) {
	return (
		<input
			type="text"
			className="w-full text-sm rounded p-2 border border-opacity-50 focus-visible:outline-none"
			required
			placeholder={placeholder}
		/>
	);
}
