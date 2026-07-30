export const SERVICE_SLUG_PATTERN = /^[a-z][a-z0-9_-]*$/;
export const RESOURCE_REF_PATTERN = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/;

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
	const dotIndex = ref.indexOf(".");
	const service = ref.slice(0, dotIndex);
	const resource = ref.slice(dotIndex + 1);
	if (RESERVED_SERVICE_SLUGS.has(service)) {
		throw new ResourceRefError(`Reserved service slug: ${service}`);
	}
	return { service, resource };
}

export function formatResourceRef(service: string, resource: string): string {
	if (!SERVICE_SLUG_PATTERN.test(service)) {
		throw new ResourceRefError(`Invalid service slug: ${service}`);
	}
	if (service.includes(".")) {
		throw new ResourceRefError(
			`Service slug must not contain a dot: ${service}`,
		);
	}
	if (!SERVICE_SLUG_PATTERN.test(resource)) {
		throw new ResourceRefError(`Invalid resource slug: ${resource}`);
	}
	if (resource.includes(".")) {
		throw new ResourceRefError(
			`Resource slug must not contain a dot: ${resource}`,
		);
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
	return (
		SERVICE_SLUG_PATTERN.test(slug) &&
		!slug.includes(".") &&
		!RESERVED_SERVICE_SLUGS.has(slug)
	);
}
