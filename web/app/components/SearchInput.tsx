import { Search, X } from "lucide-react";

import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";

const wrapperStyle: React.CSSProperties = {
	position: "relative",
	display: "flex",
	alignItems: "center",
	borderTop: "1px solid var(--color-gray-border)",
	borderBottom: "1px solid var(--color-gray-border)",
};

const iconStyle: React.CSSProperties = {
	position: "absolute",
	left: "var(--size-4)",
	width: 14,
	height: 14,
	pointerEvents: "none",
	opacity: 0.5,
};

const inputStyle: React.CSSProperties = {
	width: "100%",
	paddingTop: "var(--size-3)",
	paddingBottom: "var(--size-3)",
	paddingLeft: "calc(14px + var(--size-4) + var(--size-2))",
	paddingRight: "calc(20px + var(--size-4))",
	border: "none",
	borderRadius: 0,
	boxShadow: "none",
};

const clearStyle: React.CSSProperties = {
	position: "absolute",
	right: "var(--size-4)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 18,
	height: 18,
	padding: 0,
	border: "none",
	borderRadius: "50%",
	backgroundColor: "var(--color-evy-gray)",
	cursor: "pointer",
};

export function SearchInput({
	value,
	onChange,
	placeholder = "Search...",
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	return (
		<div style={wrapperStyle} className="evy-bg-white">
			<Search style={iconStyle} aria-hidden strokeWidth={LUCIDE_STROKE_WIDTH} />
			<input
				type="text"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				style={inputStyle}
				className="evy-focus-visible:outline-none"
			/>
			{value && (
				<button
					type="button"
					style={clearStyle}
					onClick={() => onChange("")}
					aria-label="Clear search"
				>
					<X
						width={8}
						height={8}
						strokeWidth={LUCIDE_STROKE_WIDTH}
						color="white"
						aria-hidden
					/>
				</button>
			)}
		</div>
	);
}
