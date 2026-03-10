export default function InlineIcon({
	icon,
	alt,
}: {
	icon: string;
	alt: string;
}) {
	return (
		<div className="evy-absolute evy-inset-y-0 evy-start-0 evy-flex evy-items-center evy-ps-2 evy-pointer-events-none">
			<img className="evy-h-4" src={icon} alt={alt} />
		</div>
	);
}
