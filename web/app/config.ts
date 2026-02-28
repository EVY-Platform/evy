// Build-time configuration injected via Bun's --define flag
// These values are replaced at build time with actual environment variables

declare const __API_URL__: string;

export const config = {
	apiUrl:
		typeof __API_URL__ !== "undefined" ? __API_URL__ : "ws://localhost:8000",
} as const;
