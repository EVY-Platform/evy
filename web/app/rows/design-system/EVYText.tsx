import parseIconText from "../../icons/parseIconText";
import { parseText } from "../../utils/evyInterpreter";

export default function EVYText({
	text,
	className,
}: {
	text: string;
	className?: string;
}) {
	const resolvedText = parseText(text);
	return (
		<span className={className} style={{ whiteSpace: "pre-line" }}>
			{parseIconText(resolvedText)}
		</span>
	);
}
