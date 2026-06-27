import type { Page } from "@playwright/test";
import type {
	UI_RowAction as RowAction,
	UI_Flow as ServerFlow,
	UI_Row as ServerRow,
} from "evy-types";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../app/api/sync";

interface ServerRowInput {
	id?: string;
	type: ServerRow["type"];
	source?: string;
	destination?: string;
	actions: RowAction[];
	visible?: string;
	title: string;
	children?: ServerRowInput[];
	child?: ServerRowInput;
	value?: string;
	placeholder?: string;
	text?: string;
	action?: string;
	subtitle?: string;
	label?: string;
	format?: string;
	segments?: string[];
}

interface ServerPageInput {
	id?: string;
	title: string;
	rows?: ServerRowInput[];
	footer?: ServerRowInput;
}

function ensureRowId(row: ServerRowInput): ServerRow {
	const { children, child, ...rowRest } = row;
	return {
		...rowRest,
		id: row.id ?? crypto.randomUUID(),
		source: row.source ?? "",
		visible: row.visible ?? "true",
		...(children !== undefined ? { children: ensureRowIds(children) } : {}),
		...(child !== undefined ? { child: ensureRowId(child) } : {}),
	} as ServerRow;
}

function ensureRowIds(rows: ServerRowInput[]): ServerRow[] {
	return rows.map(ensureRowId);
}

export function createTestFlows(pages: ServerPageInput[]): ServerFlow[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Test Flow",
			pages: pages.map((page) => ({
				id: page.id ?? crypto.randomUUID(),
				title: page.title,
				rows: ensureRowIds(page.rows ?? []),
				footer: page.footer ? ensureRowId(page.footer) : undefined,
			})),
		},
	];
}

export async function initTestFlows(
	page: Page,
	pages: ServerPageInput[],
	resources: ServiceResource[] = [],
	metadata: ResourceAttributeMetadata[] = [],
): Promise<void> {
	await page.addInitScript((flows: ServerFlow[]) => {
		window.__TEST_FLOWS__ = flows;
	}, createTestFlows(pages));
	await initServiceResources(page, resources);
	await initResourceAttributeMetadata(page, metadata);
}

export async function initFullFlows(
	page: Page,
	flows: ServerFlow[],
	resources: ServiceResource[] = [],
	metadata: ResourceAttributeMetadata[] = [],
): Promise<void> {
	await page.addInitScript((flows: ServerFlow[]) => {
		window.__TEST_FLOWS__ = flows;
	}, flows);
	await initServiceResources(page, resources);
	await initResourceAttributeMetadata(page, metadata);
}

export async function initServiceResources(
	page: Page,
	resources: ServiceResource[],
): Promise<void> {
	await page.addInitScript((resources: ServiceResource[]) => {
		window.__TEST_SERVICE_RESOURCES__ = resources;
	}, resources);
}

export async function initResourceAttributeMetadata(
	page: Page,
	metadata: ResourceAttributeMetadata[],
): Promise<void> {
	await page.addInitScript((metadata: ResourceAttributeMetadata[]) => {
		window.__TEST_RESOURCE_ATTRIBUTE_METADATA__ = metadata;
	}, metadata);
}

export async function openAppWithTestFlows(
	page: Page,
	pages: ServerPageInput[],
	resources: ServiceResource[] = [],
	metadata: ResourceAttributeMetadata[] = [],
): Promise<void> {
	await initTestFlows(page, pages, resources, metadata);
	await page.goto("/");
}

export async function openAppWithFullFlows(
	page: Page,
	flows: ServerFlow[],
	resources: ServiceResource[] = [],
	metadata: ResourceAttributeMetadata[] = [],
): Promise<void> {
	await initFullFlows(page, flows, resources, metadata);
	await page.goto("/");
}
