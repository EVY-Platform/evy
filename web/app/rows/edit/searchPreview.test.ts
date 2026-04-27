import { describe, expect, it } from "bun:test";
import { createElement } from "react";

import type { Row } from "../../types/row";
import InfoRow from "../view/InfoRow";
import {
	buildSearchPreviewRows,
	formatSearchPreviewString,
} from "./searchPreview";

function buildInfoTemplateRow(): Row {
	return {
		id: "info-template",
		row: createElement(InfoRow, {
			key: "info-template",
			rowId: "info-template",
		}),
		config: {
			type: "Info",
			source: "",
			destination: "",
			actions: [],
			view: {
				content: {
					title: "{$datum:value}",
					subtitle: "{$datum:city}",
					icon: "",
				},
			},
		},
	};
}

describe("formatSearchPreviewString", () => {
	it("replaces datum bindings with dummy preview values", () => {
		expect(formatSearchPreviewString("{$datum:value}")).toBe("Example tag");
		expect(formatSearchPreviewString("{$datum:city}, {$datum:postcode}")).toBe(
			"Sydney, 2000",
		);
	});
});

describe("buildSearchPreviewRows", () => {
	it("creates three formatted preview rows from the child template", () => {
		const previewRows = buildSearchPreviewRows(
			buildInfoTemplateRow(),
			"search-row",
		);

		expect(previewRows).toHaveLength(3);
		expect(previewRows.map((row) => row.id)).toEqual([
			"search-row:search-preview:0",
			"search-row:search-preview:1",
			"search-row:search-preview:2",
		]);
		expect(previewRows.map((row) => row.config.view.content.title)).toEqual([
			"Example tag",
			"Example tag",
			"Example tag",
		]);
		expect(previewRows[0]?.config.view.content.subtitle).toBe("Sydney");
	});

	it("falls back to the default info template when child is omitted", () => {
		const previewRows = buildSearchPreviewRows(undefined, "search-row");

		expect(previewRows).toHaveLength(3);
		expect(previewRows[0]?.config.type).toBe("Info");
		expect(previewRows[0]?.config.view.content.title).toBe("Example tag");
	});
});
