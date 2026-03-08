const wrapperStyle: React.CSSProperties = {
	position: "relative",
	display: "flex",
	alignItems: "center",
	borderTop: "1px solid var(--color-gray-border)",
	borderBottom: "1px solid var(--color-gray-border)",
};

const iconStyle: React.CSSProperties = {
	position: "absolute",
	left: "1rem",
	width: 14,
	height: 14,
	pointerEvents: "none",
	opacity: 0.5,
};

const inputStyle: React.CSSProperties = {
	width: "100%",
	paddingTop: "0.75rem",
	paddingBottom: "0.75rem",
	paddingLeft: "calc(14px + 1rem + 0.5rem)",
	paddingRight: "calc(20px + 1rem)",
	border: "none",
	borderRadius: 0,
	boxShadow: "none",
};

const clearStyle: React.CSSProperties = {
	position: "absolute",
	right: "1rem",
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
			<img src="/search.svg" alt="" aria-hidden="true" style={iconStyle} />
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
					<svg
						width="8"
						height="8"
						viewBox="0 0 10 10"
						fill="none"
						aria-hidden="true"
						role="img"
					>
						<path
							d="M1 1L9 9M9 1L1 9"
							stroke="white"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			)}
		</div>
	);
}
