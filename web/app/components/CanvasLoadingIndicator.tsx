export function CanvasLoadingIndicator({ isExiting }: { isExiting?: boolean }) {
	return (
		<div
			className={`evy-canvas-loading${isExiting ? " evy-canvas-loading-exit" : ""}`}
			role="status"
			aria-label="Loading EVY"
		>
			<img
				className="evy-canvas-loading-logo"
				src="/logo.svg"
				alt="EVY"
			/>
			<div className="evy-canvas-loading-bar" />
		</div>
	);
}
