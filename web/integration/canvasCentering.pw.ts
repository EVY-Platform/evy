import { expect, test } from "@playwright/test";
import invariant from "tiny-invariant";

import {
	CANVAS_EDGE_MARGIN_PX,
	COLLAPSED_PANEL_WIDTH_PX,
} from "../app/utils/canvasCentering";
import { openAppWithTestFlows } from "./flowFixtures";
import {
	createNewFlowThroughPicker,
	SELECTORS,
	waitForAppLoaded,
} from "./utils";

const CENTER_TOLERANCE_PX = 8;
const INSET_TOLERANCE_PX = 12;

function emptyPages(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		title: `Page ${index + 1}`,
		rows: [],
	}));
}

test.describe("Canvas centering", () => {
	test("centers a single page in inactive mode", async ({ page }) => {
		await openAppWithTestFlows(page, emptyPages(1));
		await waitForAppLoaded(page);

		const viewport = page.getByTestId("canvas-viewport");
		const viewportBox = await viewport.boundingBox();
		invariant(viewportBox, "Expected canvas viewport bounding box");

		const frameBox = await page
			.locator(SELECTORS.phoneContainer)
			.first()
			.boundingBox();
		invariant(frameBox, "Expected page frame bounding box");

		const frameCenter = frameBox.x + frameBox.width / 2;
		const viewportCenter = viewportBox.x + viewportBox.width / 2;
		expect(Math.abs(frameCenter - viewportCenter)).toBeLessThan(
			CENTER_TOLERANCE_PX,
		);
	});

	test("centers three pages on their midpoint in inactive mode", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, emptyPages(3));
		await waitForAppLoaded(page);

		const viewport = page.getByTestId("canvas-viewport");
		const viewportBox = await viewport.boundingBox();
		invariant(viewportBox, "Expected canvas viewport bounding box");

		const frames = page.locator(SELECTORS.phoneContainer);
		await expect(frames).toHaveCount(3);

		const firstBox = await frames.first().boundingBox();
		const lastBox = await frames.nth(2).boundingBox();
		invariant(firstBox && lastBox, "Expected page frame bounding boxes");

		const rowMidpoint = (firstBox.x + lastBox.x + lastBox.width) / 2;
		const viewportCenter = viewportBox.x + viewportBox.width / 2;
		expect(Math.abs(rowMidpoint - viewportCenter)).toBeLessThan(
			CENTER_TOLERANCE_PX,
		);
	});

	test("centers the active page after creating a new flow through the picker", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, emptyPages(1));
		await waitForAppLoaded(page);

		// Creating a flow selects it and activates its first page, expanding the
		// side panels. The active page must stay centered rather than resetting
		// to the canvas origin behind the expanded left panel.
		await createNewFlowThroughPicker(page, "Centered New Flow");
		await expect(page.getByTestId("create-flow-dialog")).not.toBeVisible();

		const viewport = page.getByTestId("canvas-viewport");
		const viewportBox = await viewport.boundingBox();
		invariant(viewportBox, "Expected canvas viewport bounding box");

		const frame = page.locator(SELECTORS.phoneContainer).first();
		const viewportCenter = viewportBox.x + viewportBox.width / 2;
		await expect(async () => {
			const frameBox = await frame.boundingBox();
			invariant(frameBox, "Expected page frame bounding box");
			const frameCenter = frameBox.x + frameBox.width / 2;
			expect(Math.abs(frameCenter - viewportCenter)).toBeLessThan(
				CENTER_TOLERANCE_PX,
			);
		}).toPass();
	});

	test("left-aligns five pages past the collapsed left panel", async ({
		page,
	}) => {
		await openAppWithTestFlows(page, emptyPages(5));
		await waitForAppLoaded(page);

		const viewport = page.getByTestId("canvas-viewport");
		const viewportBox = await viewport.boundingBox();
		invariant(viewportBox, "Expected canvas viewport bounding box");

		const frames = page.locator(SELECTORS.phoneContainer);
		await expect(frames).toHaveCount(5);

		const firstBox = await frames.first().boundingBox();
		const lastBox = await frames.nth(4).boundingBox();
		invariant(firstBox && lastBox, "Expected page frame bounding boxes");

		expect(firstBox.x).toBeGreaterThanOrEqual(
			viewportBox.x + COLLAPSED_PANEL_WIDTH_PX,
		);

		const expectedLeft =
			viewportBox.x + COLLAPSED_PANEL_WIDTH_PX + CANVAS_EDGE_MARGIN_PX;
		expect(Math.abs(firstBox.x - expectedLeft)).toBeLessThan(
			INSET_TOLERANCE_PX,
		);

		const rowMidpoint = (firstBox.x + lastBox.x + lastBox.width) / 2;
		const viewportCenter = viewportBox.x + viewportBox.width / 2;
		expect(Math.abs(rowMidpoint - viewportCenter)).toBeGreaterThan(
			CENTER_TOLERANCE_PX,
		);
	});
});
