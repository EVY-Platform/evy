import { splitFunctionArguments } from "./functionArgs";
// The function context/output types live here (the leaf module) so
// functions.ts can depend on datetime.ts without a cycle.
export type EVYFunctionContext = {
	datum?: string;
};

export type EVYFunctionOutput = {
	value: string;
	prefix?: string;
	suffix?: string;
};

type DatetimeParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	dayOfWeek: number;
};

const weekdayAbbreviations = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthAbbreviations = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function stripOptionalSurroundingQuotes(value: string): string {
	const trimmed = value.trim();
	const first = trimmed.at(0);
	const last = trimmed.at(-1);
	if ((first === '"' || first === "'") && first === last) {
		return trimmed.slice(1, -1).replace(/\\(["'])/g, "$1");
	}
	return trimmed;
}

function normalizeDateFormatPattern(pattern: string): string {
	return pattern.replaceAll("YYYY", "yyyy").replaceAll("DD", "dd");
}

function resolveDatetimeArgument(
	valueArgument: string,
	context?: EVYFunctionContext,
): string {
	const strippedValue = stripOptionalSurroundingQuotes(valueArgument);
	if (strippedValue === "$datum") return context?.datum ?? "";
	return strippedValue;
}

function hasTimezone(isoDatetime: string): boolean {
	return /(?:z|[+-]\d{2}:?\d{2})$/i.test(isoDatetime.trim());
}

function dayOfWeekFromDate(year: number, month: number, day: number): number {
	const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function getDatetimePartsWithoutTemporal(
	isoDatetime: string,
): DatetimeParts | null {
	if (hasTimezone(isoDatetime)) {
		const date = new Date(isoDatetime);
		if (Number.isNaN(date.getTime())) return null;
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		const day = date.getUTCDate();
		return {
			year,
			month,
			day,
			hour: date.getUTCHours(),
			minute: date.getUTCMinutes(),
			dayOfWeek: dayOfWeekFromDate(year, month, day),
		};
	}

	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(isoDatetime);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return {
		year,
		month,
		day,
		hour: Number(match[4]),
		minute: Number(match[5]),
		dayOfWeek: dayOfWeekFromDate(year, month, day),
	};
}

function getDatetimeParts(isoDatetime: string): DatetimeParts | null {
	try {
		if (typeof Temporal === "undefined") {
			return getDatetimePartsWithoutTemporal(isoDatetime);
		}

		if (hasTimezone(isoDatetime)) {
			const zonedDatetime =
				Temporal.Instant.from(isoDatetime).toZonedDateTimeISO("UTC");
			return {
				year: zonedDatetime.year,
				month: zonedDatetime.month,
				day: zonedDatetime.day,
				hour: zonedDatetime.hour,
				minute: zonedDatetime.minute,
				dayOfWeek: zonedDatetime.dayOfWeek,
			};
		}

		const plainDatetime = Temporal.PlainDateTime.from(isoDatetime);
		return {
			year: plainDatetime.year,
			month: plainDatetime.month,
			day: plainDatetime.day,
			hour: plainDatetime.hour,
			minute: plainDatetime.minute,
			dayOfWeek: plainDatetime.dayOfWeek,
		};
	} catch {
		return getDatetimePartsWithoutTemporal(isoDatetime);
	}
}

function daySuffix(day: number): string {
	const lastTwoDigits = day % 100;
	const lastDigit = day % 10;
	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return "th";
	if (lastDigit === 1) return "st";
	if (lastDigit === 2) return "nd";
	if (lastDigit === 3) return "rd";
	return "th";
}

function pad2(value: number): string {
	return value.toString().padStart(2, "0");
}

function hour12(hour: number): number {
	const remainder = hour % 12;
	return remainder === 0 ? 12 : remainder;
}

function formatDatetimeParts(parts: DatetimeParts, pattern: string): string {
	const normalizedPattern = normalizeDateFormatPattern(pattern);
	const tokenValues: Record<string, string> = {
		yyyy: parts.year.toString().padStart(4, "0"),
		EEE: weekdayAbbreviations[parts.dayOfWeek - 1] ?? "",
		MMM: monthAbbreviations[parts.month - 1] ?? "",
		MM: pad2(parts.month),
		dd: pad2(parts.day),
		d: parts.day.toString(),
		HH: pad2(parts.hour),
		H: parts.hour.toString(),
		hh: pad2(hour12(parts.hour)),
		h: hour12(parts.hour).toString(),
		mm: pad2(parts.minute),
		a: parts.hour < 12 ? "AM" : "PM",
		o: daySuffix(parts.day),
	};
	const tokenPattern = /yyyy|EEE|MMM|MM|dd|HH|hh|mm|d|H|h|a|o/g;
	return normalizedPattern.replace(
		tokenPattern,
		(token) => tokenValues[token] ?? token,
	);
}

export function evyFormatDatetime(
	args: string,
	context?: EVYFunctionContext,
): EVYFunctionOutput {
	const [valueArgument, patternArgument] = splitFunctionArguments(args);
	if (!valueArgument || !patternArgument) return { value: "" };

	const isoDatetime = resolveDatetimeArgument(valueArgument, context);
	const pattern = stripOptionalSurroundingQuotes(patternArgument).trim();
	if (!isoDatetime || !pattern) return { value: "" };

	const parts = getDatetimeParts(isoDatetime);
	if (!parts) return { value: pattern };

	return { value: formatDatetimeParts(parts, pattern) };
}
