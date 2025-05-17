import React from "react";
import type { Metadata } from "next";

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
						<a href="/">
							<img className="h-4" src="/logo.svg" alt="EVY" />
						</a>
					</div>
					<div className="flex flex-1 overflow-hidden">
						{children}
					</div>
				</div>
			</body>
		</html>
	);
}
