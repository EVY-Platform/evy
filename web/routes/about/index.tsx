import { PageProps } from "$fresh/server.ts";

export default function About(props: PageProps) {
	return (
		<div class="px-4 py-8">
			<div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
				<h1 class="text-4xl font-bold">Why we exist</h1>
				<div class="pt-8">
					<h4 class="text-xl font-bold text-left">- Data Privacy</h4>
					<h4 class="text-xl font-bold">- Fair Trade</h4>
					<h4 class="text-xl font-bold">- No Distractions</h4>
				</div>
			</div>
		</div>
	);
}
