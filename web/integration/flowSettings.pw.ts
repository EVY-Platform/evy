import { expect, test } from "@playwright/test";
import {
	TEST_RESOURCE_ID,
	testServiceResources,
} from "../testFixtures/resourceCatalog";
import { openAppWithTestFlows, tapAction } from "./flowFixtures";
import { getConfigPanel, popoverSelect } from "./utils";

const TEST_SERVICE_RESOURCES = testServiceResources();

test.describe("Flow settings modal", () => {
	test("flow submits declaration can be set and cleared as one target", async ({
		page,
	}) => {
		await openAppWithTestFlows(
			page,
			[
				{
					id: "step_1",
					title: "Test Page",
					rows: [
						{
							type: "text",
							title: "Hello",
							visible: "true",
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
		);

		await page.getByRole("button", { name: "Flow settings" }).click();

		const settingsDialog = page.getByTestId("flow-settings-dialog");
		await expect(settingsDialog).toBeVisible();

		const serviceSelect = settingsDialog.getByLabel("Flow submits service");
		await popoverSelect(page, serviceSelect, "Test Service");

		const resourceSelect = settingsDialog.getByLabel(
			"Flow submits resource",
		);
		await popoverSelect(page, resourceSelect, "Records");

		await settingsDialog.getByRole("button", { name: "Save" }).click();
		await expect(settingsDialog).not.toBeVisible();

		await page.getByRole("button", { name: "Flow settings" }).click();
		await expect(settingsDialog).toBeVisible();
		await expect(serviceSelect).toHaveAttribute(
			"data-value",
			"test_service",
		);
		await expect(resourceSelect).toHaveAttribute(
			"data-value",
			TEST_RESOURCE_ID.RECORDS,
		);

		await popoverSelect(page, serviceSelect, "None");
		await settingsDialog.getByRole("button", { name: "Save" }).click();
		await expect(settingsDialog).not.toBeVisible();

		await page.getByRole("button", { name: "Flow settings" }).click();
		await expect(settingsDialog).toBeVisible();
		await expect(serviceSelect).toHaveAttribute("data-value", "");
	});

	test("opens from action popup and guards conflicting submits changes", async ({
		page,
	}) => {
		await openAppWithTestFlows(
			page,
			[
				{
					title: "Create Page",
					rows: [
						{
							type: "input",
							title: "Title",
							value: "",
							placeholder: "",
							destination: `{${TEST_RESOURCE_ID.RECORDS}.title}`,
						},
						{
							type: "button",
							title: "",
							label: "Submit Create",
							actions: tapAction(
								`{create(${TEST_RESOURCE_ID.RECORDS},submit)}`,
							),
						},
					],
				},
			],
			TEST_SERVICE_RESOURCES,
			[],
			{
				resource: TEST_RESOURCE_ID.RECORDS,
			},
		);

		await page.getByText("Submit Create", { exact: true }).first().click();
		const configPanel = getConfigPanel(page);
		await configPanel.getByLabel("Edit action 1").click();

		const popup = page.getByRole("dialog", { name: "Edit action 1" });
		await expect(popup).toBeVisible();

		await popup
			.getByRole("button", {
				name: "Creates from row destinations and draft updates",
			})
			.click();

		const settingsDialog = page.getByTestId("flow-settings-dialog");
		await expect(settingsDialog).toBeVisible();

		const serviceSelect = settingsDialog.getByLabel("Flow submits service");
		await popoverSelect(page, serviceSelect, "None");

		const saveButton = settingsDialog.getByRole("button", { name: "Save" });
		await expect(saveButton).toBeDisabled();
		await expect(
			settingsDialog.getByText(/creates Records on submit/i),
		).toBeVisible();

		await settingsDialog
			.getByLabel("Flow name")
			.fill("Renamed Submit Flow");
		await popoverSelect(page, serviceSelect, "Test Service");
		const resourceSelect = settingsDialog.getByLabel(
			"Flow submits resource",
		);
		await popoverSelect(page, resourceSelect, "Records");

		await saveButton.click();
		await expect(settingsDialog).not.toBeVisible();
		await expect(popup).toBeVisible();

		await popup
			.getByRole("button", {
				name: "Creates from row destinations and draft updates",
			})
			.click();
		await expect(settingsDialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(settingsDialog).not.toBeVisible();
		await expect(popup).toBeVisible();
	});
});
