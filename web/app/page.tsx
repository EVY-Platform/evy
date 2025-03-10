"use client";

import Logo from "./components/shared/logo.tsx";
import Editor from "./components/shared/editor.tsx";

export default function Index() {
	return (
		<div className="h-screen flex flex-col overflow-hidden">
			<div className="border-b p-4">
				<Logo />
			</div>
			<div className="flex flex-1 overflow-hidden">
				<Editor />
			</div>
		</div>
	);
}
