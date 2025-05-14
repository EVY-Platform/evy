import Input from "./input";

export default function Dropdown() {
	return (
		<div className="relative">
			<Input />
			<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
				<img className="h-4" src="/arrow_down.svg" alt="Select" />
			</div>
		</div>
	);
}
