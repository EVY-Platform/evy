import type { ReactNode } from "react";
import EVYText from "./EVYText";

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
			<p className={titleClassName}>
				<EVYText text={title} />
			</p>
			{children}
		</div>
	);
}
