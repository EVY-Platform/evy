// Build-time configuration injected via Bun's --define flag
// These values are replaced at build time with actual environment variables

declare const __API_URL__: string;

if (typeof __API_URL__ === "undefined" || __API_URL__ === "") {
	throw new Error("__API_URL__ is required (set API_URL at build time)");
}
export const config = {
	apiUrl: __API_URL__,
} as const;
