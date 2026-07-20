import type { ReactNode } from "react";
import EVYText from "./EVYText";

export function RowLayout({
	title,
	children,
	fullWidthContent = false,
}: {
	title: string;
	children?: ReactNode;
	fullWidthContent?: boolean;
}) {
	const titleElement = title.trim() ? (
		<p className="evy-text-md">
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
