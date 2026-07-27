/**
 * EVY text attributes interpolate only inside curly braces ("Hello {name}!").
 * These helpers locate those spans so display logic can tell an id reference
 * apart from a word that merely looks like one.
 */

/** A top-level `{…}` span, as interior [start, end) offsets of the raw value. */
export type InterpolationRegion = { start: number; end: number };

export function findInterpolationRegions(value: string): InterpolationRegion[] {
	const regions: InterpolationRegion[] = [];
	let depth = 0;
	let regionStart = 0;

	for (let index = 0; index < value.length; index++) {
		const character = value[index];
		if (character === "{") {
			if (depth === 0) regionStart = index + 1;
			depth += 1;
			continue;
		}
		if (character === "}" && depth > 0) {
			depth -= 1;
			if (depth === 0) regions.push({ start: regionStart, end: index });
		}
	}

	// The builder resolves ids while the user is still typing, so an unclosed
	// brace keeps its region open to the end of the value.
	if (depth > 0) regions.push({ start: regionStart, end: value.length });

	return regions;
}

export function isRangeInsideRegions(
	regions: InterpolationRegion[],
	start: number,
	end: number,
): boolean {
	return regions.some((region) => region.start <= start && end <= region.end);
}
