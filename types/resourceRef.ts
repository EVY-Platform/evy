const SERVICE_SLUG_PATTERN = /^[a-z][a-z0-9_-]*$/;
const RESOURCE_REF_PATTERN = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/;

export const RESERVED_SERVICE_SLUGS = new Set(["local", "cache", "draft"]);

export class ResourceRefError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResourceRefError";
	}
}

export function parseResourceRef(ref: string): {
	service: string;
	resource: string;
} {
	if (!RESOURCE_REF_PATTERN.test(ref)) {
		throw new ResourceRefError(`Invalid resource ref: ${ref}`);
	}
	const [service, resource] = ref.split(".");
	if (RESERVED_SERVICE_SLUGS.has(service)) {
		throw new ResourceRefError(`Reserved service slug: ${service}`);
	}
	return { service, resource };
}

export function formatResourceRef(service: string, resource: string): string {
	if (!SERVICE_SLUG_PATTERN.test(service)) {
		throw new ResourceRefError(`Invalid service slug: ${service}`);
	}
	if (!SERVICE_SLUG_PATTERN.test(resource)) {
		throw new ResourceRefError(`Invalid resource slug: ${resource}`);
	}
	if (RESERVED_SERVICE_SLUGS.has(service)) {
		throw new ResourceRefError(`Reserved service slug: ${service}`);
	}
	return `${service}.${resource}`;
}

export function serviceOfRef(ref: string): string {
	return parseResourceRef(ref).service;
}

export function isValidResourceRef(ref: string): boolean {
	try {
		parseResourceRef(ref);
		return true;
	} catch {
		return false;
	}
}

export function isValidServiceSlug(slug: string): boolean {
	return SERVICE_SLUG_PATTERN.test(slug) && !RESERVED_SERVICE_SLUGS.has(slug);
}

export function assertValidServiceSlug(id: string): void {
	if (!isValidServiceSlug(id)) {
		throw new Error(`Invalid service slug: ${id}`);
	}
}
