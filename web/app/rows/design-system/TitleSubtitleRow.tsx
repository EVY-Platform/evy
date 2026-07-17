import type { ReactNode } from "react";
import EVYText from "./EVYText";
import { lineClampStyle } from "./lineClamp";

export function TitleSubtitleRow({
	title,
	subtitle = "",
	titleBold = false,
	centerSubtitleWhenTitleEmpty = false,
	trailing,
}: {
	title: string;
	subtitle?: string;
	titleBold?: boolean;
	centerSubtitleWhenTitleEmpty?: boolean;
	trailing?: ReactNode;
}) {
	const showsTitle = Boolean(title.trim());
	const showsSubtitle = Boolean(subtitle.trim());
	const centerSubtitle =
		centerSubtitleWhenTitleEmpty && !showsTitle && showsSubtitle;

	return (
		<div className="evy-flex evy-flex-row evy-items-center evy-gap-2 evy-p-2">
			<div className="evy-flex-1 evy-min-w-0">
				{showsTitle ? (
					<p
						className={`evy-text-md${titleBold ? " evy-font-semibold" : ""}`}
						style={lineClampStyle(1)}
					>
						<EVYText text={title} />
					</p>
				) : null}
				{showsSubtitle ? (
					<p
						className={`evy-text-sm evy-text-gray${centerSubtitle ? " evy-text-center" : ""}`}
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
