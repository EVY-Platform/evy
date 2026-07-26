import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";
import { procedureResultAttributes } from "evy-types/procedures";
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
import { unwrapOptionalBraces } from "./unwrapBraces";

type IdCandidateCategory =
	| "Flow"
	| "Page"
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

export type IdDisplayPart =
	| {
			type: "text";
			text: string;
			start: number;
			end: number;
	  }
	| {
			type: "candidate";
			rawId: string;
			displayName: string;
			start: number;
			end: number;
	  }
	| {
			type: "attribute";
			text: string;
			start: number;
			end: number;
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
	"buildCurrency",
	"buildAddress",
];

function isIdBoundaryCharacter(character: string | undefined): boolean {
	return !character || !/[a-zA-Z0-9_-]/.test(character);
}

function isTextCandidate(candidate: IdCandidate): boolean {
	return candidate.insertMode === "text";
}

function isDisplayCandidate(candidate: IdCandidate): boolean {
	return (
		!isTextCandidate(candidate) &&
		(candidate.category === "Resource" ||
			candidate.category === "Service" ||
			candidate.category === "Flow" ||
			candidate.category === "Page")
	);
}

export function getCandidateInsertValue(candidate: IdCandidate): string {
	return isTextCandidate(candidate) ? candidate.name : candidate.id;
}

export function buildIdCandidates(
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	serviceResources: ServiceResource[],
	serviceNamesById: Map<string, string>,
): IdCandidate[] {
	const flowCandidates = Object.values(flowsById).map((flow) => ({
		id: flow.id,
		name: flow.name,
		category: "Flow" as const,
	}));

	const pageCandidates = Object.values(pagesById).map((page) => ({
		id: page.id,
		name: page.name,
		category: "Page" as const,
	}));

	const serviceCandidates = Array.from(
		new Set(serviceResources.map((resource) => resource.fkServiceId)),
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

	return [
		...flowCandidates,
		...pageCandidates,
		...serviceCandidates,
		...resourceCandidates,
	];
}

export function buildAttributeCandidates(
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

function getCandidateNameAndCategoryKey(candidate: IdCandidate): string {
	return `${candidate.category}:${candidate.name}`;
}

function dedupeCandidatesByNameAndCategory(
	candidates: IdCandidate[],
): IdCandidate[] {
	const seenCandidateKeys = new Set<string>();

	return candidates.filter((candidate) => {
		const candidateKey = getCandidateNameAndCategoryKey(candidate);
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

function resolveSourceResourceId(
	source: string,
	serviceResources: { id: string }[],
): string | null {
	const sourcePath = unwrapOptionalBraces(source);
	const resourceId = sourcePath.split(".")[0]?.trim();
	if (!resourceId) return null;
	return serviceResources.some((resource) => resource.id === resourceId)
		? resourceId
		: null;
}

function resolveQualifierResourceId(
	qualifier: string,
	serviceResources: { id: string }[],
	rowSource?: string,
): string | null {
	if (rowSource !== undefined && qualifier === "$datum") {
		return resolveSourceResourceId(rowSource, serviceResources);
	}
	return serviceResources.some((resource) => resource.id === qualifier)
		? qualifier
		: null;
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
				candidate.name.toLowerCase().startsWith(normalizedQuery),
			)
		: candidates;

	return dedupeCandidatesByNameAndCategory(matchingCandidates).slice(
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

function buildDisplayCandidates(candidates: IdCandidate[]): IdCandidate[] {
	return candidates
		.filter(isDisplayCandidate)
		.toSorted((a, b) => b.id.length - a.id.length);
}

export function getIdDisplayText(
	value: string,
	candidates: IdCandidate[],
): string {
	return getIdDisplayParts(value, candidates)
		.map((part) =>
			part.type === "candidate" ? part.displayName : part.text,
		)
		.join("");
}

export function getIdDisplayParts(
	value: string,
	candidates: IdCandidate[],
): IdDisplayPart[] {
	const displayCandidates = buildDisplayCandidates(candidates);
	const parts: IdDisplayPart[] = [];
	let textStart = 0;
	let index = 0;

	while (index < value.length) {
		const candidate = displayCandidates.find(
			(displayCandidate) =>
				isIdBoundaryCharacter(value[index - 1]) &&
				value.startsWith(displayCandidate.id, index) &&
				isIdBoundaryCharacter(
					value[index + displayCandidate.id.length],
				),
		);

		if (!candidate) {
			index++;
			continue;
		}

		if (textStart < index) {
			parts.push({
				type: "text",
				text: value.slice(textStart, index),
				start: textStart,
				end: index,
			});
		}

		const end = index + candidate.id.length;
		parts.push({
			type: "candidate",
			rawId: candidate.id,
			displayName: candidate.name,
			start: index,
			end,
		});
		index = end;
		textStart = end;

		while (value[index] === ".") {
			const separatorStart = index;
			const attributeStart = separatorStart + 1;
			let attributeEnd = attributeStart;
			while (
				attributeEnd < value.length &&
				/[a-zA-Z0-9_$-]/.test(value[attributeEnd])
			) {
				attributeEnd++;
			}
			if (attributeEnd === attributeStart) break;

			parts.push({
				type: "text",
				text: value.slice(separatorStart, attributeStart),
				start: separatorStart,
				end: attributeStart,
			});
			parts.push({
				type: "attribute",
				text: value.slice(attributeStart, attributeEnd),
				start: attributeStart,
				end: attributeEnd,
			});
			index = attributeEnd;
			textStart = attributeEnd;
		}
	}

	if (textStart < value.length) {
		parts.push({
			type: "text",
			text: value.slice(textStart),
			start: textStart,
			end: value.length,
		});
	}

	return parts.length > 0
		? parts
		: [{ type: "text", text: value, start: 0, end: value.length }];
}
