export default function InlineIcon({
	icon,
	alt,
}: {
	icon: string;
	alt: string;
}) {
	return (
		<div className="absolute inset-y-0 start-0 flex items-center ps-2 pointer-events-none">
			<img className="h-4" src={icon} alt={alt} />
		</div>
	);
}
