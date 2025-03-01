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
			<body>{children}</body>
		</html>
	);
}
