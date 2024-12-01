import { useSignal } from "@preact/signals";
import Counter from "../islands/Counter.tsx";
import Logo from "../islands/Logo.tsx";

export default function Home() {
	const count = useSignal(3);
	return (
		<div class="px-4 py-8">
			<div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
				<Logo />
				<h1 class="text-4xl font-bold">App builder</h1>
				<Counter count={count} />
			</div>
		</div>
	);
}
