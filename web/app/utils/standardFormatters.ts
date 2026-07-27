import type { EVYFormatterDefinition } from "./dynamicFormatters";

const currencyAudTemplate = "$" + "{formatDecimal(input.value, 2)}";

export const STANDARD_FORMATTERS: EVYFormatterDefinition[] = [
	{
		name: "formatCurrency",
		formatting_config: "{input.currency}",
		formatting: {
			AUD: currencyAudTemplate,
			EUR: "€{formatDecimal(input.value, 2)}",
			default: currencyAudTemplate,
		},
	},
	{
		name: "formatAddress",
		formatting_config: "{input.country}",
		formatting: {
			Australia:
				"{input.unit} {input.street}, {input.postcode} {input.city} {input.state}",
			"United States":
				"{input.unit} {input.street}, {input.city} {input.state} {input.postcode}",
			default:
				"{input.unit} {input.street}, {input.postcode} {input.city} {input.state}",
		},
	},
];
