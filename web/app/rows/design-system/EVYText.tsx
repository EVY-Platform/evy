import parseIconText from "../../icons/parseIconText";

export default function EVYText({
	text,
	className,
}: {
	text: string;
	className?: string;
}) {
	return <span className={className}>{parseIconText(text)}</span>;
}
