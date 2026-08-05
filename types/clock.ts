/**
 * The single source of server timestamps.
 *
 * Timestamps double as version tokens and sync cursors, and they live in
 * `text` columns compared as strings - so every value is UTC with exactly
 * nine fractional digits, which makes lexicographic order chronological
 * order. `Date.now()` only ticks per millisecond, so the sub-millisecond
 * part comes from `Bun.nanoseconds()`; that is what lets two writes inside
 * the same millisecond get distinct, ordered versions without reading the
 * row being replaced.
 *
 * Bun-only by design (see the api and marketplace Dockerfiles). Never import
 * this from `web/`.
 */

const NANOS_PER_MILLISECOND = 1_000_000;

let wallAnchorMs = Date.now();
let monoAnchorNs = Bun.nanoseconds();
let lastMs = 0;
let lastFracNs = 0;

function nowParts(): { ms: number; fracNs: number } {
	const mono = Bun.nanoseconds();
	const wallMs = Date.now();
	const elapsedNs = mono - monoAnchorNs;
	let ms = wallAnchorMs + Math.floor(elapsedNs / NANOS_PER_MILLISECOND);
	let fracNs = elapsedNs % NANOS_PER_MILLISECOND;

	// The monotonic clock drifts against the wall clock over a long uptime;
	// re-anchoring whenever the wall clock is ahead keeps the two within a
	// millisecond without ever letting the value jump backwards.
	if (wallMs > ms) {
		wallAnchorMs = wallMs;
		monoAnchorNs = mono;
		ms = wallMs;
		fracNs = 0;
	}

	// Two calls can still land on one nanosecond tick, and re-anchoring resets
	// the sub-millisecond phase, so the sequence is forced strictly upward.
	if (ms < lastMs || (ms === lastMs && fracNs <= lastFracNs)) {
		ms = lastMs;
		fracNs = lastFracNs + 1;
		if (fracNs === NANOS_PER_MILLISECOND) {
			ms += 1;
			fracNs = 0;
		}
	}

	lastMs = ms;
	lastFracNs = fracNs;
	return { ms, fracNs };
}

/** Now, as a nine-fractional-digit UTC ISO-8601 string. */
export function nowIso(): string {
	const { ms, fracNs } = nowParts();
	// toISOString() supplies the first three fractional digits; the remaining
	// six are the nanosecond remainder inside that millisecond.
	return `${new Date(ms).toISOString().slice(0, -1)}${String(fracNs).padStart(6, "0")}Z`;
}

/**
 * A client-supplied timestamp in the same fixed-width form, so the column
 * stays comparable. Unparseable input is returned untouched - schema
 * validation, not this function, decides what is acceptable.
 */
export function toNanoIso(iso: string): string {
	const parsedMs = Date.parse(iso);
	if (Number.isNaN(parsedMs)) return iso;
	// Date.parse drops everything past three fractional digits, so any
	// sub-millisecond precision the caller sent is carried over by hand.
	const fraction = /\.(\d+)/.exec(iso)?.[1] ?? "";
	const subMs =
		fraction.length > 3 ? fraction.slice(3, 9).padEnd(6, "0") : "000000";
	return `${new Date(parsedMs).toISOString().slice(0, -1)}${subMs}Z`;
}
