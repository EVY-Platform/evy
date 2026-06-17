import type { ReactNode } from "react";
import EVYText from "./EVYText";

export function RowLayout({
	title,
	children,
	titleClassName = "evy-text-md",
	fullWidthContent = false,
}: {
	title: string;
	children?: ReactNode;
	titleClassName?: string;
	fullWidthContent?: boolean;
}) {
	const titleElement = title.trim() ? (
		<p className={titleClassName}>
			<EVYText text={title} />
		</p>
	) : null;

	if (fullWidthContent) {
		return (
			<div>
				{titleElement && <div className="evy-p-2">{titleElement}</div>}
				{children}
			</div>
		);
	}

	return (
		<div className="evy-p-2">
			{titleElement}
			{children}
		</div>
	);
}
