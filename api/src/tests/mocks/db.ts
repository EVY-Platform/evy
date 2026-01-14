/**
 * Mock database utilities for testing.
 * Simulates Drizzle's chainable query builder pattern.
 */

// Store for mock data that tests can manipulate
export const mockStore = {
	devices: [] as Array<{
		token: string;
		os: string;
		createdAt: Date;
	}>,
	services: [] as Array<{
		id: string;
		name: string;
		description: string;
		createdAt: Date;
		updatedAt: Date;
	}>,
	organizations: [] as Array<{
		id: string;
		name: string;
		description: string;
		logo: string;
		url: string;
		supportEmail: string;
		createdAt: Date;
		updatedAt: Date;
	}>,
	serviceProviders: [] as Array<{
		id: string;
		fkServiceId: string;
		fkOrganizationId: string;
		name: string;
		description: string;
		logo: string;
		url: string;
		createdAt: Date;
		updatedAt: Date;
		retired: boolean;
	}>,
	flows: [] as Array<{
		id: string;
		data: unknown;
		createdAt: Date;
		updatedAt: Date;
	}>,
};

// Helper to reset mock store between tests
export function resetMockStore() {
	mockStore.devices = [];
	mockStore.services = [];
	mockStore.organizations = [];
	mockStore.serviceProviders = [];
	mockStore.flows = [];
}

// Helper to get the appropriate store for a table
function getStoreForTable(table: unknown): unknown[] {
	const tableObj = table as { _: { name: string } } | undefined;
	const tableName = tableObj?._?.name;

	switch (tableName) {
		case "Device":
			return mockStore.devices;
		case "Service":
			return mockStore.services;
		case "Organization":
			return mockStore.organizations;
		case "ServiceProvider":
			return mockStore.serviceProviders;
		case "Flow":
			return mockStore.flows;
		default:
			return [];
	}
}

// Create chainable query builder mock
function createSelectBuilder(selectFields?: Record<string, unknown>) {
	let currentTable: unknown = null;
	let whereCondition: ((item: unknown) => boolean) | null = null;
	let orderByField: string | null = null;
	let orderDirection: "asc" | "desc" = "asc";
	let limitCount: number | null = null;

	const builder = {
		from(table: unknown) {
			currentTable = table;
			return builder;
		},
		where(condition: unknown) {
			// The condition is typically an eq() result, we need to handle it
			whereCondition = condition as (item: unknown) => boolean;
			return builder;
		},
		orderBy(order: unknown) {
			// Extract order info from drizzle orderBy
			const orderObj = order as { column?: { name?: string }; order?: string };
			if (orderObj?.column?.name) {
				orderByField = orderObj.column.name;
				orderDirection = (orderObj?.order as "asc" | "desc") || "desc";
			}
			return builder;
		},
		limit(count: number) {
			limitCount = count;
			return builder;
		},
		then(resolve: (value: unknown[]) => void) {
			let results = [...getStoreForTable(currentTable)];

			// Apply where filter if set
			if (whereCondition) {
				results = results.filter(whereCondition);
			}

			// Apply ordering if set
			if (orderByField) {
				results.sort((a, b) => {
					const aVal = (a as Record<string, unknown>)[orderByField as string];
					const bVal = (b as Record<string, unknown>)[orderByField as string];
					if (aVal instanceof Date && bVal instanceof Date) {
						return orderDirection === "desc"
							? bVal.getTime() - aVal.getTime()
							: aVal.getTime() - bVal.getTime();
					}
					return 0;
				});
			}

			// Apply limit if set
			if (limitCount !== null) {
				results = results.slice(0, limitCount);
			}

			// Apply field selection if specified
			if (selectFields) {
				results = results.map((item) => {
					const selected: Record<string, unknown> = {};
					for (const key of Object.keys(selectFields)) {
						selected[key] = (item as Record<string, unknown>)[key];
					}
					return selected;
				});
			}

			resolve(results);
		},
	};

	return builder;
}

function createInsertBuilder(table: unknown) {
	let insertData: unknown = null;

	const builder = {
		values(data: unknown) {
			insertData = data;
			return builder;
		},
		returning() {
			const store = getStoreForTable(table);
			const dataToInsert = insertData as Record<string, unknown>;
			store.push(dataToInsert as never);
			return Promise.resolve([dataToInsert]);
		},
		then(resolve: (value: void) => void) {
			const store = getStoreForTable(table);
			const dataToInsert = insertData as Record<string, unknown>;
			store.push(dataToInsert as never);
			resolve();
		},
	};

	return builder;
}

function createUpdateBuilder(table: unknown) {
	let updateData: unknown = null;
	let whereCondition: ((item: unknown) => boolean) | null = null;

	const builder = {
		set(data: unknown) {
			updateData = data;
			return builder;
		},
		where(condition: unknown) {
			whereCondition = condition as (item: unknown) => boolean;
			return builder;
		},
		returning() {
			const store = getStoreForTable(table);
			const updated: unknown[] = [];

			for (let i = 0; i < store.length; i++) {
				if (whereCondition && whereCondition(store[i])) {
					const updatedItem = {
						...(store[i] as Record<string, unknown>),
						...(updateData as Record<string, unknown>),
					};
					store[i] = updatedItem as never;
					updated.push(updatedItem);
				}
			}

			return Promise.resolve(updated);
		},
	};

	return builder;
}

function createDeleteBuilder(table: unknown) {
	let whereCondition: ((item: unknown) => boolean) | null = null;

	const builder = {
		where(condition: unknown) {
			whereCondition = condition as (item: unknown) => boolean;
			return builder;
		},
		returning() {
			const store = getStoreForTable(table) as unknown[];
			const deleted: unknown[] = [];

			for (let i = store.length - 1; i >= 0; i--) {
				if (whereCondition && whereCondition(store[i])) {
					deleted.unshift(store[i]);
					store.splice(i, 1);
				}
			}

			return Promise.resolve(deleted);
		},
	};

	return builder;
}

// The main mock db object
export const mockDb = {
	select(fields?: Record<string, unknown>) {
		return createSelectBuilder(fields);
	},
	insert(table: unknown) {
		return createInsertBuilder(table);
	},
	update(table: unknown) {
		return createUpdateBuilder(table);
	},
	delete(table: unknown) {
		return createDeleteBuilder(table);
	},
};

// Mock condition creators (eq, gt, desc)
export function createMockEq(column: unknown, value: unknown) {
	const col = column as { name?: string };
	const fieldName = col?.name;
	return (item: unknown) => {
		const record = item as Record<string, unknown>;
		return record[fieldName as string] === value;
	};
}

export function createMockGt(column: unknown, value: unknown) {
	const col = column as { name?: string };
	const fieldName = col?.name;
	return (item: unknown) => {
		const record = item as Record<string, unknown>;
		const itemValue = record[fieldName as string];
		if (itemValue instanceof Date && value instanceof Date) {
			return itemValue.getTime() > value.getTime();
		}
		return (itemValue as number) > (value as number);
	};
}

export function createMockDesc(column: unknown) {
	const col = column as { name?: string };
	return { column: col, order: "desc" };
}
