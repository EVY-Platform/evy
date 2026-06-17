import type { ReactNode } from "react";
import EVYText from "./EVYText";

function classNames(...values: Array<string | undefined>) {
	return values.filter(Boolean).join(" ");
}

export function RowLayout({
	title,
	children,
	titleClassName = "evy-text-md",
	contentClassName,
	childrenClassName,
	fullWidthContent = false,
}: {
	title: string;
	children?: ReactNode;
	titleClassName?: string;
	contentClassName?: string;
	childrenClassName?: string;
	fullWidthContent?: boolean;
}) {
	const titleElement = title.trim() ? (
		<p className={titleClassName}>
			<EVYText text={title} />
		</p>
	) : null;
	const childrenElement = childrenClassName ? (
		<div className={childrenClassName}>{children}</div>
	) : (
		children
	);

	if (fullWidthContent) {
		return (
			<div className={contentClassName}>
				<div className="evy-p-2">{titleElement}</div>
				{childrenElement}
			</div>
		);
	}

	return (
		<div className={classNames("evy-p-2", contentClassName)}>
			{titleElement}
			{childrenElement}
		</div>
	);
}
