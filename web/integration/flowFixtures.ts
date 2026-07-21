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
import { getRowBindingFields } from "../app/rows/rowFields";

interface ServerRowInput {
	id?: string;
	type: ServerRow["type"];
	source?: string;
	destination?: string;
	actions: RowAction[];
	visible?: string;
	name?: string;
	title: string;
	children?: ServerRowInput[];
	child?: ServerRowInput;
	sheet?: ServerRowInput;
	value?: string;
	placeholder?: string;
	text?: string;
	action?: string;
	subtitle?: string;
	label?: string;
	format?: string;
	segments?: string[];
	initial?: string;
}

interface ServerPageInput {
	id?: string;
	name?: string;
	title: string;
	rows?: ServerRowInput[];
	footer?: ServerRowInput;
}

function ensureRowId(row: ServerRowInput): ServerRow {
	const { children, child, sheet, ...rowRest } = row;
	const base: Record<string, unknown> = {
		...rowRest,
		id: row.id ?? crypto.randomUUID(),
		name: row.name ?? row.title,
		visible: row.visible ?? "true",
	};
	for (const field of getRowBindingFields(row.type)) {
		const value = row[field];
		if (typeof value === "string" && value.length > 0) {
			base[field] = value;
		}
	}
	return {
		...base,
		...(children !== undefined ? { children: ensureRowIds(children) } : {}),
		...(child !== undefined ? { child: ensureRowId(child) } : {}),
		...(sheet !== undefined ? { sheet: ensureRowId(sheet) } : {}),
	} as ServerRow;
}

function ensureRowIds(rows: ServerRowInput[]): ServerRow[] {
	return rows.map(ensureRowId);
}

function fillServerRowName(row: ServerRow): ServerRow {
	const children = (row as { children?: ServerRow[] }).children;
	const child = (row as { child?: ServerRow }).child;
	const sheet = (row as { sheet?: ServerRow }).sheet;
	return {
		...row,
		name: row.name || row.title,
		...(children !== undefined
			? { children: children.map(fillServerRowName) }
			: {}),
		...(child !== undefined ? { child: fillServerRowName(child) } : {}),
		...(sheet !== undefined ? { sheet: fillServerRowName(sheet) } : {}),
	} as ServerRow;
}

function fillEntityNames(flows: ServerFlow[]): ServerFlow[] {
	return flows.map((flow) => ({
		...flow,
		pages: flow.pages.map((page) => ({
			...page,
			name: page.name || page.title,
			rows: page.rows.map(fillServerRowName),
			...(page.footer !== undefined
				? { footer: fillServerRowName(page.footer) }
				: {}),
		})),
	}));
}

function createTestFlows(pages: ServerPageInput[]): ServerFlow[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Test Flow",
			pages: pages.map((page) => ({
				id: page.id ?? crypto.randomUUID(),
				name: page.name ?? page.title,
				title: page.title,
				rows: ensureRowIds(page.rows ?? []),
				footer: page.footer ? ensureRowId(page.footer) : undefined,
			})),
		},
	];
}

async function initTestFlows(
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
	}, fillEntityNames(flows));
	await initServiceResources(page, resources);
	await initResourceAttributeMetadata(page, metadata);
}

async function initServiceResources(
	page: Page,
	resources: ServiceResource[],
): Promise<void> {
	await page.addInitScript((resources: ServiceResource[]) => {
		window.__TEST_SERVICE_RESOURCES__ = resources;
	}, resources);
}

async function initResourceAttributeMetadata(
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
