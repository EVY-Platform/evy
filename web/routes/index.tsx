import { Head } from "$fresh/runtime.ts";

export default function Home() {
	return (
		<>
			<Head>
				<meta charset="UTF-8" />
				<title>EVY App builder</title>
				<meta
					name="description"
					content="The EVY App builder is a tool that allows you to build apps for EVY"
				/>
				<link rel="stylesheet" href="styles.css" />
				<script src="script.js"></script>
			</Head>
			<div class="px-4 py-8">
				<div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
					<h1 class="text-4xl font-bold">App builder</h1>
				</div>
			</div>
		</>
	);
}
