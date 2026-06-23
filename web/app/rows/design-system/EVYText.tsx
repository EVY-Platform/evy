import { useParseText } from "../../hooks/useParseText";
import parseIconText from "../../icons/parseIconText";

export default function EVYText({
	text,
	className,
}: {
	text?: string;
	className?: string;
}) {
	const parseText = useParseText();
	const resolvedText = parseText(text ?? "");
	return (
		<span className={className} style={{ whiteSpace: "pre-line" }}>
			{parseIconText(resolvedText)}
		</span>
	);
}
