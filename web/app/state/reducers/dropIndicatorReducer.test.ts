import { describe, expect, it } from "bun:test";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

import type { DropIndicatorState } from "../../types/actions";
import { dropIndicatorReducer } from "./dropIndicatorReducer";

describe("dropIndicatorReducer", () => {
	it("tracks page edge indicator state", () => {
		const state = dropIndicatorReducer(null, {
			type: "SET_INDICATOR_PAGE_POSITION",
			pageId: "page-1",
			position: "end",
		});

		expect(state).toEqual({ pageId: "page-1", pageDropPosition: "end" });
	});

	it("clears page edge position without clearing the page target", () => {
		const result = dropIndicatorReducer(
			{ pageId: "page-1", pageDropPosition: "start" },
			{ type: "UNSET_INDICATOR_PAGE_POSITION" },
		);

		expect(result).toEqual({
			pageId: "page-1",
			pageDropPosition: undefined,
		});
	});

	it("clears page target and page edge position together", () => {
		const state: DropIndicatorState = {
			rowId: "row-1",
			edge: "bottom" as Edge,
			pageId: "page-1",
			pageDropPosition: "end",
		};

		const result = dropIndicatorReducer(state, {
			type: "UNSET_INDICATOR_PAGE",
		});

		expect(result).toEqual({
			rowId: "row-1",
			edge: "bottom",
			pageId: undefined,
			pageDropPosition: undefined,
		});
	});

	it("tracks row indicators without clearing page indicators", () => {
		const result = dropIndicatorReducer(
			{ pageId: "page-1", pageDropPosition: "start" },
			{ type: "SET_INDICATOR_ROW", rowId: "row-1", edge: "top" as Edge },
		);

		expect(result).toEqual({
			pageId: "page-1",
			pageDropPosition: "start",
			rowId: "row-1",
			edge: "top",
		});
	});

	it("clears row indicators without clearing page indicators", () => {
		const result = dropIndicatorReducer(
			{
				rowId: "row-1",
				edge: "top" as Edge,
				pageId: "page-1",
				pageDropPosition: "end",
			},
			{ type: "UNSET_INDICATOR_ROW" },
		);

		expect(result).toEqual({
			rowId: undefined,
			edge: undefined,
			pageId: "page-1",
			pageDropPosition: "end",
		});
	});
});
