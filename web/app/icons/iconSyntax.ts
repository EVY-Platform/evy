/** Lucide default stroke for inline / row icons (matches prior SVG weight). */
export const LUCIDE_STROKE_WIDTH = 2;

/** Matches `::kebab-case::` tokens inside a longer string. */
export const PARSE_ICON_REGEX = /::([a-zA-Z0-9-]+)::/g;

/** Whole string is exactly one `::icon::` token (e.g. InlineIcon `icon` prop). */
export const FULL_ICON_TOKEN_REGEX = /^::([a-zA-Z0-9-]+)::$/;
