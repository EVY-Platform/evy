import type { ReactNode } from "react";

export function RowLayout({
	title,
	children,
	titleClassName = "evy-text-md",
}: {
	title: string;
	children?: ReactNode;
	titleClassName?: string;
}) {
	return (
		<div className="evy-p-2">
			<p className={titleClassName}>{title}</p>
			{children}
		</div>
	);
}
