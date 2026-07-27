import type { DATA_EVY_Formatter } from "./generated/ts/data/data";

/**
 * The formatter rows every EVY install starts with. They are data, not code:
 * the seed script inserts them and both clients read them back over sync, so
 * this is the single definition the seed and the client tests share.
 *
 * iOS cannot import this; evySeedStandardFormattersForTests repeats the rows
 * for its unit tests and has to be updated alongside this file.
 */
export type StandardFormatter = Pick<
	DATA_EVY_Formatter,
	"id" | "name" | "formatting_config" | "formatting"
>;

// Split so the template literal is not read as a JS interpolation.
const CURRENCY_AUD_TEMPLATE = "$" + "{formatDecimal(input.value, 2)}";
const ADDRESS_AU_TEMPLATE =
	"{input.unit} {input.street}, {input.postcode} {input.city} {input.state}";

export const STANDARD_FORMATTERS: StandardFormatter[] = [
	{
		id: "f1e2d3c4-b5a6-4789-8abc-def012345601",
		name: "formatCurrency",
		formatting_config: "{input.currency}",
		formatting: {
			AUD: CURRENCY_AUD_TEMPLATE,
			EUR: "€{formatDecimal(input.value, 2)}",
			default: CURRENCY_AUD_TEMPLATE,
		},
	},
	{
		id: "f1e2d3c4-b5a6-4789-8abc-def012345602",
		name: "formatAddress",
		formatting_config: "{input.country}",
		formatting: {
			Australia: ADDRESS_AU_TEMPLATE,
			"United States":
				"{input.unit} {input.street}, {input.city} {input.state} {input.postcode}",
			default: ADDRESS_AU_TEMPLATE,
		},
	},
];
