/**
 * Pure formatting helpers aligned with SDData docs and the iOS client.
 * Use when server-side evaluation of EVY template functions is needed.
 */

/** Split top-level comma-separated arguments, respecting nested parentheses and double-quoted segments. */
export function splitFunctionArguments(args: string): string[] {
	const components: string[] = [];
	let current = "";
	let depth = 0;
	let inString = false;

	for (const ch of args) {
		if (inString) {
			current += ch;
			if (ch === '"') {
				inString = false;
			}
			continue;
		}
		switch (ch) {
			case '"':
				inString = true;
				current += ch;
				break;
			case "(":
				depth += 1;
				current += ch;
				break;
			case ")":
				depth -= 1;
				current += ch;
				break;
			case ",":
				if (depth === 0) {
					const t = current.trim();
					if (t.length > 0) {
						components.push(t);
					}
					current = "";
				} else {
					current += ch;
				}
				break;
			default:
				current += ch;
		}
	}
	const tail = current.trim();
	if (tail.length > 0) {
		components.push(tail);
	}
	return components;
}

export function stripOptionalSurroundingQuotes(s: string): string {
	const trimmed = s.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function pad2(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

export function normalizeDateFormatPattern(pattern: string): string {
	return pattern.replaceAll("YYYY", "yyyy").replaceAll("DD", "dd");
}

/** Format an ISO 8601 / RFC 3339 instant using a Java-style pattern (MM/dd/yyyy, etc.). Parsed in UTC. */
export function formatDateIso(iso: string, pattern: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) {
		throw new Error(`functions.formatDateIso: invalid ISO date '${iso}'`);
	}
	const p = normalizeDateFormatPattern(pattern);
	return p.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, (token) => {
		switch (token) {
			case "yyyy":
				return String(d.getUTCFullYear());
			case "yy":
				return String(d.getUTCFullYear()).slice(-2);
			case "MM":
				return pad2(d.getUTCMonth() + 1);
			case "dd":
				return pad2(d.getUTCDate());
			case "HH":
				return pad2(d.getUTCHours());
			case "mm":
				return pad2(d.getUTCMinutes());
			case "ss":
				return pad2(d.getUTCSeconds());
			default:
				return token;
		}
	});
}

export function formatDecimal(value: number, fractionDigits: number): string {
	const places = Math.max(0, Math.min(20, Math.floor(fractionDigits)));
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: places,
		maximumFractionDigits: places,
		useGrouping: false,
		roundingMode: "halfExpand",
	}).format(value);
}

/** Millimetres to metres with two fraction digits and an `m` suffix (e.g. 23240 → "23.24m"). */
export function formatMetricLengthMm(mm: number): string {
	const metres = mm / 1000;
	return `${formatDecimal(metres, 2)}m`;
}

/** Millimetres to feet with two fraction digits and an `ft` suffix (international foot = 0.3048 m). */
export function formatImperialLengthMm(mm: number): string {
	const feet = mm / 304.8;
	return `${formatDecimal(feet, 2)}ft`;
}

export function formatDurationMs(ms: number): string {
	const n = Math.max(0, Math.floor(ms));
	const units: [number, string, string][] = [
		[86_400_000, "day", "days"],
		[3_600_000, "hour", "hours"],
		[60_000, "minute", "minutes"],
		[1000, "second", "seconds"],
	];
	for (const [unitMs, singular, plural] of units) {
		if (n >= unitMs) {
			const count = Math.floor(n / unitMs);
			return `${count} ${count === 1 ? singular : plural}`;
		}
	}
	return `${n} milliseconds`;
}
