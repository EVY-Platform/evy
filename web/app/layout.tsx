import React from "react";
import type { Metadata } from "next";

import Logo from "./components/shared/logo.tsx";

import "./globals.css";

export const metadata: Metadata = {
	title: "EVY App builder",
	description:
		"The EVY App builder is a tool that allows you to build apps for EVY",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<div className="h-screen flex flex-col overflow-hidden">
					<div className="border-b p-4">
						<Logo />
					</div>
					<div className="flex flex-1 overflow-hidden">
						{children}
					</div>
				</div>
			</body>
		</html>
	);
}
