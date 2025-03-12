export default function Input() {
	return (
		<form className="grid">
			<input
				type="text"
				className="w-full text-sm rounded p-2 border border-opacity-50 focus-visible:outline-none"
				required
			/>
		</form>
	);
}
