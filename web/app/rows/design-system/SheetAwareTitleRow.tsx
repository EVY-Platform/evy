import type { ReactNode } from "react";
import EVYText from "./EVYText";
import { lineClampStyle } from "./lineClamp";

export function SheetAwareTitleRow({
	title,
	subtitle,
	trailing,
}: {
	title: string;
	subtitle: string;
	trailing?: ReactNode;
}) {
	return (
		<div className="evy-flex evy-flex-row evy-items-center evy-gap-2 evy-p-2">
			<div className="evy-flex-1 evy-min-w-0">
				{title.trim() ? (
					<p className="evy-text-md" style={lineClampStyle(1)}>
						<EVYText text={title} />
					</p>
				) : null}
				{subtitle.trim() ? (
					<p
						className="evy-text-sm evy-text-gray"
						style={lineClampStyle(3)}
					>
						<EVYText text={subtitle} />
					</p>
				) : null}
			</div>
			{trailing}
		</div>
	);
}
