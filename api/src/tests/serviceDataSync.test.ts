import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	RESOURCES_BY_SERVICE,
	type GetRequest,
	type GetResponse,
	type UI_Flow,
} from "evy-types";

const forwardUnaryMock = mock(
	async (
		_serviceName: string,
		_method: "get",
		params: GetRequest,
	): Promise<GetResponse> => [{ id: `${params.resource}-1` }],
);

mock.module("../services", () => ({
	forwardUnary: forwardUnaryMock,
}));

const { extractBindingsFromString, extractCandidatesFromBinding, tokenize } =
	await import("../expressionParser");
const {
	discoverReferencedServices,
	extractCandidatesFromFlows,
	resolveCandidateToService,
	syncServiceData,
} = await import("../serviceDataSync");

const EPOCH = "1970-01-01T00:00:00.000Z";

function testRow(overrides: Partial<UI_Flow["pages"][number]["rows"][number]>) {
	return {
		id: crypto.randomUUID(),
		type: "Text",
		source: "",
		destination: "",
		actions: [],
		view: {
			content: {
				title: "",
			},
		},
		...overrides,
	} satisfies UI_Flow["pages"][number]["rows"][number];
}

function testFlow(): UI_Flow {
	const navigateFlowId = crypto.randomUUID();
	const navigatePageId = crypto.randomUUID();

	return {
		id: crypto.randomUUID(),
		name: "Binding extraction flow",
		pages: [
			{
				id: crypto.randomUUID(),
				title: "Page",
				rows: [
					testRow({
						type: "SheetContainer",
						source: "{item}",
						destination: "{buildCurrency(price)}",
						actions: [
							{
								condition: "{length(title) > 0 && price.value >= 1}",
								false: "{highlight_required(title)}",
								true: `{navigate(${navigateFlowId},${navigatePageId})}`,
							},
						],
						view: {
							content: {
								title: "{conditions}",
								child: testRow({
									type: "InputList",
									source: "{tags}",
									view: {
										content: {
											title: "Tags",
											format: "{$datum:value}",
										},
									},
								}),
								children: [
									testRow({
										type: "Search",
										source: "{$api:tags}",
										destination: "{tags}",
										view: {
											content: {
												title: "",
												placeholder: "Search",
												child: testRow({
													type: "Info",
													source: "",
													view: {
														content: {
															title: "{$datum:value}",
															subtitle: "{$local:address}",
														},
													},
												}),
											},
										},
									}),
									testRow({
										type: "Text",
										source: "",
										view: {
											content: {
												title: "",
												text: "{formatCurrency(price)}",
											},
										},
									}),
								],
							},
						},
					}),
				],
				footer: testRow({
					type: "Button",
					source: "{item}",
					actions: [{ condition: "", false: "", true: "{create(item)}" }],
					view: {
						content: {
							title: "",
							label: "Create",
						},
					},
				}),
			},
		],
	};
}

beforeEach(() => {
	forwardUnaryMock.mockClear();
	forwardUnaryMock.mockImplementation(
		async (
			_serviceName: string,
			_method: "get",
			params: GetRequest,
		): Promise<GetResponse> => [{ id: `${params.resource}-1` }],
	);
});

describe("expression parser utility", () => {
	it("extracts all braced bindings from a string", () => {
		expect(
			extractBindingsFromString(
				"{item.title} costs {formatCurrency(price)} and {$datum:value}",
			),
		).toEqual(["item.title", "formatCurrency(price)", "$datum:value"]);
	});

	it("extracts plain identifiers and root path segments", () => {
		expect(extractCandidatesFromBinding("selling_reasons")).toEqual([
			"selling_reasons",
		]);
		expect(extractCandidatesFromBinding("item.title")).toEqual(["item"]);
		expect(extractCandidatesFromBinding("price.value")).toEqual(["price"]);
	});

	it("extracts function arguments without extracting function names", () => {
		expect(extractCandidatesFromBinding("formatCurrency(price)")).toEqual([
			"price",
		]);
		expect(extractCandidatesFromBinding("create(item)")).toEqual(["item"]);
		expect(extractCandidatesFromBinding("highlight_required(title)")).toEqual([
			"title",
		]);
		expect(extractCandidatesFromBinding("close()")).toEqual([]);
	});

	it("skips uuid-like function arguments", () => {
		expect(
			extractCandidatesFromBinding(
				"navigate(ca47e6c5-0000-4000-8000-000000000000,06b21b52-0000-4000-8000-000000000000)",
			),
		).toEqual([]);
	});

	it("extracts operands from comparison expressions", () => {
		expect(extractCandidatesFromBinding("length(title) > 0")).toEqual([
			"title",
		]);
		expect(
			extractCandidatesFromBinding("length(title) > 0 && price.value >= 1"),
		).toEqual(["title", "price"]);
	});

	it("does not extract numeric, string, boolean, or null literals", () => {
		expect(
			extractCandidatesFromBinding(
				'length(title) > 0 && status == "active" && enabled != false && deletedAt == null',
			),
		).toEqual(["title", "status", "enabled", "deletedAt"]);
	});

	it("excludes api, local, and datum bindings", () => {
		expect(extractCandidatesFromBinding("$api:tags")).toEqual([]);
		expect(extractCandidatesFromBinding("$local:address")).toEqual([]);
		expect(extractCandidatesFromBinding("$datum:value")).toEqual([]);
	});

	it("tokenizes boolean expressions while keeping function calls intact", () => {
		expect(tokenize("length(title) > 0 && price.value >= 1")).toEqual([
			"length(title)",
			">",
			"0",
			"&&",
			"price.value",
			">=",
			"1",
		]);
	});
});

describe("service data sync utilities", () => {
	it("extracts candidates recursively from source, destination, actions, nested child rows, nested children arrays, and footers", () => {
		const candidates = extractCandidatesFromFlows([testFlow()]);

		expect(candidates.has("item")).toBe(true);
		expect(candidates.has("conditions")).toBe(true);
		expect(candidates.has("price")).toBe(true);
		expect(candidates.has("title")).toBe(true);
		expect(candidates.has("tags")).toBe(true);

		expect(candidates.has("$api:tags")).toBe(false);
		expect(candidates.has("$local:address")).toBe(false);
		expect(candidates.has("$datum:value")).toBe(false);
		expect(candidates.has("formatCurrency")).toBe(false);
		expect(candidates.has("create")).toBe(false);
		expect(candidates.has("navigate")).toBe(false);
	});

	it("maps singular and plural resource candidates to services", () => {
		expect(resolveCandidateToService("conditions")).toBe("marketplace");
		expect(resolveCandidateToService("item")).toBe("marketplace");
		expect(resolveCandidateToService("items")).toBe("marketplace");
		expect(resolveCandidateToService("price")).toBeNull();
		expect(resolveCandidateToService("title")).toBeNull();
	});

	it("discovers referenced services from flow bindings", () => {
		expect([...discoverReferencedServices([testFlow()])]).toEqual([
			"marketplace",
		]);
	});
});

describe("syncServiceData", () => {
	it("returns all changed marketplace resources", async () => {
		const result = await syncServiceData({
			service: "marketplace",
			lastSyncTime: EPOCH,
		});

		expect(result.data.map((row) => row.resource)).toEqual([
			...RESOURCES_BY_SERVICE.marketplace,
		]);
		expect(result.data.every((row) => row.service === "marketplace")).toBe(
			true,
		);
		expect(result.data.every((row) => Array.isArray(row.value))).toBe(true);
		expect(forwardUnaryMock).toHaveBeenCalledTimes(
			RESOURCES_BY_SERVICE.marketplace.length,
		);
	});

	it("passes updatedAfter to each underlying get request", async () => {
		await syncServiceData({
			service: "marketplace",
			lastSyncTime: EPOCH,
		});

		for (const call of forwardUnaryMock.mock.calls) {
			const [serviceName, method, params] = call;
			expect(serviceName).toBe("marketplace");
			expect(method).toBe("get");
			expect(params.filter?.updatedAfter).toBe(EPOCH);
		}
	});

	it("returns an empty data array when no resources changed", async () => {
		forwardUnaryMock.mockImplementation(async (): Promise<GetResponse> => []);

		const result = await syncServiceData({
			service: "marketplace",
			lastSyncTime: "2999-01-01T00:00:00.000Z",
		});

		expect(result).toEqual({ data: [] });
	});

	it("rejects missing or invalid lastSyncTime", async () => {
		await expect(
			syncServiceData({
				service: "marketplace",
			}),
		).rejects.toThrow("Invalid or missing lastSyncTime");

		await expect(
			syncServiceData({
				service: "marketplace",
				lastSyncTime: "not-a-date",
			}),
		).rejects.toThrow("SyncServiceDataRequest validation failed");
	});

	it("rejects missing, invalid, or core services", async () => {
		await expect(
			syncServiceData({
				lastSyncTime: EPOCH,
			}),
		).rejects.toThrow("Invalid or missing service");

		await expect(
			syncServiceData({
				service: "unknown",
				lastSyncTime: EPOCH,
			}),
		).rejects.toThrow("Invalid or unsupported service");

		await expect(
			syncServiceData({
				service: "evy",
				lastSyncTime: EPOCH,
			}),
		).rejects.toThrow("Invalid or unsupported service");
	});

	it("returns items as an array", async () => {
		const result = await syncServiceData({
			service: "marketplace",
			lastSyncTime: EPOCH,
		});

		const itemsRow = result.data.find((row) => row.resource === "items");
		expect(itemsRow).toBeDefined();
		expect(Array.isArray(itemsRow?.value)).toBe(true);
	});
});
