import { describe, expect, it } from "bun:test";

import {
	CANVAS_EDGE_MARGIN_PX,
	COLLAPSED_PANEL_WIDTH_PX,
	horizontalCenterOffset,
} from "./canvasCentering";

const VIEWPORT_LEFT = 100;
const VIEWPORT_WIDTH = 1280;

describe("horizontalCenterOffset", () => {
	it("centers a single narrow content block in a wide viewport", () => {
		const contentWidth = 336;
		const contentLeft = VIEWPORT_LEFT + 16;

		const dx = horizontalCenterOffset({
			viewportLeft: VIEWPORT_LEFT,
			viewportWidth: VIEWPORT_WIDTH,
			contentLeft,
			contentWidth,
		});

		const contentCenter = contentLeft + contentWidth / 2;
		const viewportCenter = VIEWPORT_LEFT + VIEWPORT_WIDTH / 2;
		expect(contentCenter + dx).toBeCloseTo(viewportCenter, 0);
	});

	it("centers a block that fits within the safe area", () => {
		const inset = COLLAPSED_PANEL_WIDTH_PX + CANVAS_EDGE_MARGIN_PX;
		const safeWidth = VIEWPORT_WIDTH - inset * 2;
		const contentWidth = safeWidth - 50;
		const contentLeft = VIEWPORT_LEFT + 200;

		const dx = horizontalCenterOffset({
			viewportLeft: VIEWPORT_LEFT,
			viewportWidth: VIEWPORT_WIDTH,
			contentLeft,
			contentWidth,
		});

		const desiredLeft = VIEWPORT_LEFT + (VIEWPORT_WIDTH - contentWidth) / 2;
		expect(contentLeft + dx).toBeCloseTo(desiredLeft, 0);
	});

	it("left-aligns a block wider than the safe area", () => {
		const inset = COLLAPSED_PANEL_WIDTH_PX + CANVAS_EDGE_MARGIN_PX;
		const safeWidth = VIEWPORT_WIDTH - inset * 2;
		const contentWidth = safeWidth + 200;
		const contentLeft = VIEWPORT_LEFT;

		const dx = horizontalCenterOffset({
			viewportLeft: VIEWPORT_LEFT,
			viewportWidth: VIEWPORT_WIDTH,
			contentLeft,
			contentWidth,
		});

		expect(contentLeft + dx).toBeCloseTo(VIEWPORT_LEFT + inset, 0);
	});

	it("returns ~0 when content is already correctly placed", () => {
		const contentWidth = 336;
		const desiredLeft = VIEWPORT_LEFT + (VIEWPORT_WIDTH - contentWidth) / 2;

		const dx = horizontalCenterOffset({
			viewportLeft: VIEWPORT_LEFT,
			viewportWidth: VIEWPORT_WIDTH,
			contentLeft: desiredLeft,
			contentWidth,
		});

		expect(Math.abs(dx)).toBeLessThan(0.5);
	});
});
