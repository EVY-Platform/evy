import { describe, expect, it } from "bun:test";
import { STANDARD_FORMATTERS } from "evy-types/standardFormatters";
import {
	lookupFormatterTemplate,
	sanitizeFormatterTemplate,
} from "./dynamicFormatters";
import { evaluateDynamicFormatter } from "./functions";

describe("dynamicFormatters", () => {
	it("looks up templates case-insensitively and falls back to default", () => {
		expect(
			lookupFormatterTemplate(
				{ AUD: "$1.00", default: "$0.00" },
				"aud",
				"formatCurrency",
			),
		).toBe("$1.00");
		expect(
			lookupFormatterTemplate(
				{ AUD: "$1.00", default: "$0.00" },
				"EUR",
				"formatCurrency",
			),
		).toBe("$0.00");
	});

	it("skips empty address fields and tidies separators", () => {
		expect(
			sanitizeFormatterTemplate(
				"{input.unit} {input.street}, {input.postcode} {input.city} {input.state}",
				{
					unit: "",
					street: "28 Rothschild Avenue",
					postcode: "2018",
					city: "Rosebery",
					state: "NSW",
				},
			),
		).toBe("28 Rothschild Avenue, 2018 Rosebery NSW");
	});

	it("formats AUD currency from synced templates", () => {
		const output = evaluateDynamicFormatter(
			"formatCurrency",
			"item.price",
			{
				formatters: STANDARD_FORMATTERS,
				resolvePath: (path) =>
					path === "item.price"
						? { currency: "AUD", value: "13.23" }
						: undefined,
			},
		);
		expect(output.value).toBe("$13.23");
	});

	it("returns bare currency value while editing", () => {
		const output = evaluateDynamicFormatter(
			"formatCurrency",
			"item.price",
			{
				formatters: STANDARD_FORMATTERS,
				editing: true,
				resolvePath: (path) =>
					path === "item.price"
						? { currency: "AUD", value: "13.23" }
						: undefined,
			},
		);
		expect(output.value).toBe("13.23");
	});

	it("formats addresses from synced templates", () => {
		const output = evaluateDynamicFormatter("formatAddress", "pickup", {
			formatters: STANDARD_FORMATTERS,
			resolvePath: (path) =>
				path === "pickup"
					? {
							unit: "C509",
							street: "28 Rothschild Avenue",
							postcode: "2018",
							city: "Rosebery",
							state: "NSW",
							country: "Australia",
						}
					: undefined,
		});
		expect(output.value).toBe(
			"C509 28 Rothschild Avenue, 2018 Rosebery NSW",
		);
	});
});
