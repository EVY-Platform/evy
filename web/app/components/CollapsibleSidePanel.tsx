import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";

import {
	collapsedPanelBarStyle,
	panelContentFadeTransitionStyle,
	panelShadowStyle,
	rightPanelStyle,
	sidePanelWidthTransitionStyle,
} from "../appLayoutStyles";

const PANEL_EXPANDED_WIDTH_PX = 300;

const LEFT_PANEL_BORDER_STYLE: CSSProperties = {
	borderRightWidth: "1px",
	borderRightStyle: "solid",
};

export function useHoverToggle() {
	const [hovered, setHovered] = useState(false);
	const open = useCallback(() => {
		setHovered(true);
	}, []);
	const close = useCallback(() => {
		setHovered(false);
	}, []);
	return { hovered, open, close };
}

type CollapsibleSidePanelSide = "left" | "right";

export function CollapsibleSidePanel({
	side,
	isExpanded,
	pinOpenByPage,
	onOpenInteraction,
	onCloseInteraction,
	collapsedLabel,
	icon,
	children,
}: {
	side: CollapsibleSidePanelSide;
	isExpanded: boolean;
	pinOpenByPage: boolean;
	onOpenInteraction: () => void;
	onCloseInteraction: () => void;
	collapsedLabel: string;
	icon: ReactNode;
	children: ReactNode;
}) {
	const outerRef = useRef<HTMLDivElement>(null);
	const isExpandedRef = useRef(isExpanded);
	const [contentVisible, setContentVisible] = useState(isExpanded);

	isExpandedRef.current = isExpanded;

	useEffect(() => {
		if (!isExpanded) {
			setContentVisible(false);
		}
	}, [isExpanded]);

	useEffect(() => {
		const node = outerRef.current;
		if (!node) return;

		const onTransitionEnd = (event: TransitionEvent) => {
			if (event.propertyName !== "width") return;
			if (!isExpandedRef.current) return;
			setContentVisible(true);
		};

		node.addEventListener("transitionend", onTransitionEnd);
		return () => node.removeEventListener("transitionend", onTransitionEnd);
	}, []);

	const outerStyle = useMemo<CSSProperties>(() => {
		return {
			...sidePanelWidthTransitionStyle,
			position: "absolute",
			top: 0,
			bottom: 0,
			zIndex: 20,
			width: isExpanded ? PANEL_EXPANDED_WIDTH_PX : "var(--size-nav-bar)",
			...(side === "left" ? { left: 0 } : { right: 0 }),
			...(side === "left"
				? { ...panelShadowStyle, ...LEFT_PANEL_BORDER_STYLE }
				: rightPanelStyle),
		};
	}, [isExpanded, side]);

	useEffect(() => {
		const node = outerRef.current;
		if (!node) return;

		const handleMouseLeave = () => {
			if (!pinOpenByPage) {
				onCloseInteraction();
			}
		};

		node.addEventListener("mouseenter", onOpenInteraction);
		node.addEventListener("mouseleave", handleMouseLeave);
		return () => {
			node.removeEventListener("mouseenter", onOpenInteraction);
			node.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [onOpenInteraction, onCloseInteraction, pinOpenByPage]);

	const outerClassName =
		"evy-flex evy-flex-col evy-overflow-hidden evy-bg-white evy-border-gray";

	const innerClassName =
		side === "left"
			? "evy-flex evy-flex-1 evy-min-h-0 evy-flex-col evy-overflow-hidden"
			: "evy-flex evy-flex-1 evy-min-h-0 evy-flex-col evy-overflow-y-auto";

	const innerContentStyle = useMemo(
		() => ({
			...panelContentFadeTransitionStyle,
			opacity: contentVisible ? 1 : 0,
			pointerEvents: contentVisible ? ("auto" as const) : ("none" as const),
		}),
		[contentVisible],
	);

	return (
		<div ref={outerRef} className={outerClassName} style={outerStyle}>
			{isExpanded ? (
				<div className={innerClassName} style={innerContentStyle}>
					{children}
				</div>
			) : (
				<button
					type="button"
					style={collapsedPanelBarStyle}
					className="evy-cursor-pointer evy-border-none evy-bg-white evy-focus-visible:outline-none"
					onClick={onOpenInteraction}
					aria-label={collapsedLabel}
				>
					{icon}
				</button>
			)}
		</div>
	);
}
