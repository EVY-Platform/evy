import { type PageProps } from "$fresh/server.ts";
import { Partial } from "$fresh/runtime.ts";

import Navbar from "../components/Navbar.tsx";

export default function App({ Component }: PageProps) {
	return (
		<html>
			<head>
				<meta charset="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1.0"
				/>
				<title>EVY App builder</title>
				<meta
					name="description"
					content="The EVY App builder is a tool that allows you to build apps for EVY"
				/>
				<link rel="stylesheet" href="/styles.css" />
			</head>
			<body f-client-nav>
				<Navbar />
				<Partial name="body">
					<Component />
				</Partial>
			</body>
		</html>
	);
}
