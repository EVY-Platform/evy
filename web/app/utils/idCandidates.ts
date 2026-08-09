import { procedureResultAttributes } from "evy-types/procedures";
import { serviceOfRef, splitRefFromPath } from "evy-types/resourceRef";
import { unwrapOptionalBraces } from "evy-types/unwrapBraces";
import {
	getAllRowBindingFieldNames,
	getAllRowContentFieldNames,
} from "../rows/rowFields";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../types/resources";
import { ACTION_FUNCTIONS } from "./actionBranch";
import { ROW_ATTRIBUTE_STATIC_NAMES } from "./rowConstants";
import { parseApiSourceMethod } from "./sourceBinding";

type IdCandidateCategory =
	| "Resource"
	| "Variable"
	| "Service"
	| "Attribute"
	| "Function";

export type IdCandidate = {
	id: string;
	name: string;
	category: IdCandidateCategory;
	insertMode?: "text";
};

type SuggestionFilterContext =
	| { type: "root"; query: string }
	| { type: "attribute"; query: string }
	| { type: "none"; query: string };

const DATUM_CANDIDATE_ID = "$datum";
const MAX_FILTERED_CANDIDATES = 20;
const functionCandidateNames = [
	...ACTION_FUNCTIONS,
	"count",
	"length",
	"findFirst",
	"filter",
	"sort",
	"owns",
	"if",
	"formatDecimal",
	"formatMetricLength",
	"formatImperialLength",
	"formatDuration",
	"formatDatetime",
	"formatDimension",
	"formatWeight",
	"formatCurrency",
	"formatAddress",
	"formatAddressLine1",
	"formatAddressLine2",
];

function isTextCandidate(candidate: IdCandidate): boolean {
	return candidate.insertMode === "text";
}

export function getCandidateInsertValue(candidate: IdCandidate): string {
	return isTextCandidate(candidate) ? candidate.name : candidate.id;
}

function getLastDottedSegment(value: string): string {
	const lastDot = value.lastIndexOf(".");
	return lastDot >= 0 ? value.slice(lastDot + 1) : value;
}

function candidateMatchesQuery(
	candidate: IdCandidate,
	normalizedQuery: string,
): boolean {
	const insertValue = getCandidateInsertValue(candidate).toLowerCase();
	const lastSegment = getLastDottedSegment(insertValue);
	return (
		insertValue.startsWith(normalizedQuery) ||
		lastSegment.startsWith(normalizedQuery)
	);
}

export function buildIdCandidates(
	serviceResources: ServiceResource[],
	serviceNamesById: Map<string, string>,
): IdCandidate[] {
	const serviceCandidates = Array.from(
		new Set(serviceResources.map((resource) => serviceOfRef(resource.id))),
	).map((serviceId) => ({
		id: serviceId,
		name: serviceNamesById.get(serviceId) ?? serviceId,
		category: "Service" as const,
	}));

	const resourceCandidates = serviceResources.map((resource) => ({
		id: resource.id,
		name: resource.name,
		category: "Resource" as const,
	}));

	return [...serviceCandidates, ...resourceCandidates];
}

function buildAttributeCandidates(
	attributeNames: Iterable<string>,
): IdCandidate[] {
	return [...new Set(attributeNames)]
		.toSorted((a, b) => a.localeCompare(b))
		.map((attributeName) => ({
			id: attributeName,
			name: attributeName,
			category: "Attribute" as const,
			insertMode: "text" as const,
		}));
}

function getCandidateInsertValueKey(candidate: IdCandidate): string {
	return `${candidate.category}:${getCandidateInsertValue(candidate)}`;
}

function dedupeCandidatesByInsertValueAndCategory(
	candidates: IdCandidate[],
): IdCandidate[] {
	const seenCandidateKeys = new Set<string>();

	return candidates.filter((candidate) => {
		const candidateKey = getCandidateInsertValueKey(candidate);
		if (seenCandidateKeys.has(candidateKey)) return false;

		seenCandidateKeys.add(candidateKey);
		return true;
	});
}

export function buildRowAttributeCandidates(): IdCandidate[] {
	const attributeNames = new Set<string>([
		...ROW_ATTRIBUTE_STATIC_NAMES,
		...getAllRowContentFieldNames(),
		...getAllRowBindingFieldNames(),
	]);
	return buildAttributeCandidates(attributeNames);
}

export function buildResourceAttributeCandidatesForResource(
	resourceAttributeMetadata: ResourceAttributeMetadata[],
	resourceId: string,
): IdCandidate[] {
	const metadata = resourceAttributeMetadata.find(
		(resourceMetadata) => resourceMetadata.resourceId === resourceId,
	);
	return buildAttributeCandidates(metadata?.attributeNames ?? []);
}

function resolveResourceRefFromPath(
	path: string,
	serviceResources: { id: string }[],
): string | null {
	const split = splitRefFromPath(path);
	if (!split) return null;
	if (serviceResources.some((resource) => resource.id === split.ref)) {
		return split.ref;
	}
	return null;
}

function resolveSourceResourceId(
	source: string,
	serviceResources: { id: string }[],
): string | null {
	const sourcePath = unwrapOptionalBraces(source);
	return resolveResourceRefFromPath(sourcePath, serviceResources);
}

function resolveQualifierResourceId(
	qualifier: string,
	serviceResources: { id: string }[],
	rowSource?: string,
): string | null {
	if (rowSource !== undefined && qualifier === "$datum") {
		return resolveSourceResourceId(rowSource, serviceResources);
	}
	return resolveResourceRefFromPath(qualifier, serviceResources);
}

export function createGetAttributeCandidatesForQualifier({
	serviceResources,
	resourceAttributeMetadata,
	rowSource,
}: {
	serviceResources: { id: string }[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
	rowSource?: string;
}): (qualifier: string) => IdCandidate[] {
	return (qualifier: string) => {
		if (rowSource !== undefined && qualifier === "$datum") {
			const apiMethod = parseApiSourceMethod(rowSource);
			if (apiMethod) {
				return buildAttributeCandidates(
					procedureResultAttributes(apiMethod),
				);
			}
		}

		const resourceId = resolveQualifierResourceId(
			qualifier,
			serviceResources,
			rowSource,
		);
		return resourceId
			? buildResourceAttributeCandidatesForResource(
					resourceAttributeMetadata,
					resourceId,
				)
			: [];
	};
}

export function buildDatumCandidate(): IdCandidate {
	return {
		id: DATUM_CANDIDATE_ID,
		name: DATUM_CANDIDATE_ID,
		category: "Variable",
		insertMode: "text",
	};
}

export function buildFunctionCandidates(): IdCandidate[] {
	return Array.from(new Set(functionCandidateNames))
		.toSorted((a, b) => a.localeCompare(b))
		.map((functionName) => ({
			id: functionName,
			name: `${functionName}()`,
			category: "Function" as const,
			insertMode: "text" as const,
		}));
}

// exported for tests
export function filterCandidates(
	candidates: IdCandidate[],
	query: string,
): IdCandidate[] {
	const normalizedQuery = query.trim().toLowerCase();
	const matchingCandidates = normalizedQuery
		? candidates.filter((candidate) =>
				candidateMatchesQuery(candidate, normalizedQuery),
			)
		: candidates;

	return dedupeCandidatesByInsertValueAndCategory(matchingCandidates).slice(
		0,
		MAX_FILTERED_CANDIDATES,
	);
}

function isRootExpressionCandidate(candidate: IdCandidate): boolean {
	return (
		candidate.category === "Service" ||
		candidate.category === "Resource" ||
		candidate.category === "Function" ||
		candidate.id === DATUM_CANDIDATE_ID
	);
}

export function filterCandidatesForSuggestionContext(
	candidates: IdCandidate[],
	scopedAttributeCandidates: IdCandidate[],
	context: SuggestionFilterContext,
): IdCandidate[] {
	if (context.type === "root") {
		return filterCandidates(
			candidates.filter(isRootExpressionCandidate),
			context.query,
		);
	}

	if (context.type === "attribute") {
		return filterCandidates(scopedAttributeCandidates, context.query);
	}

	return [];
}
