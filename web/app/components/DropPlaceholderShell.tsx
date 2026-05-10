import { forwardRef, type CSSProperties, type ReactNode } from "react";

type DropPlaceholderShellProps = {
	children: ReactNode;
	isDraggedOver: boolean;
	className?: string;
	style?: CSSProperties;
};

export const DropPlaceholderShell = forwardRef<
	HTMLDivElement,
	DropPlaceholderShellProps
>(function DropPlaceholderShell(
	{ children, isDraggedOver, className, style },
	ref,
) {
	return (
		<div
			ref={ref}
			className={`evy-flex evy-items-center evy-justify-center evy-w-full evy-rounded-sm${className ? ` ${className}` : ""}`}
			style={{
				minHeight: "var(--size-8)",
				border: "2px dashed var(--color-evy-blue)",
				backgroundColor: isDraggedOver ? "var(--color-evy-blue)" : undefined,
				opacity: isDraggedOver ? 1 : 0.8,
				transition: "background-color 0.1s ease, opacity 0.1s ease",
				...style,
			}}
		>
			<span
				className="evy-text-sm"
				style={{ color: isDraggedOver ? "white" : "var(--color-evy-blue)" }}
			>
				{children}
			</span>
		</div>
	);
});
