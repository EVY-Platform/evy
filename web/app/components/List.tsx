import React from "react";

export default function List({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <div className="overflow-y-scroll">{children}</div>;
}
