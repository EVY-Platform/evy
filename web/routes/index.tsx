import { useSignal } from "@preact/signals";
import Counter from "../islands/Counter.tsx";

export default function Home() {
	const count = useSignal(3);
	return (
		<div class="px-4 py-8 mx-auto bg-[#FFFFFF]">
			<div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
				<img
					class="my-6"
					src="/logo.svg"
					width="128"
					height="128"
					alt="EVY, the everything app"
				/>
				<h1 class="text-4xl font-bold">App builder</h1>
				<Counter count={count} />
			</div>
		</div>
	);
}
