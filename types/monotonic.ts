/**
 * The next timestamp, guaranteed to be greater than the previous one when
 * wall-clock time has millisecond resolution and two writes land in the same ms.
 */
export function monotonicIso(
	nowIso: string,
	previousIso: string | undefined,
): string {
	if (!previousIso || nowIso > previousIso) return nowIso;
	return new Date(new Date(previousIso).getTime() + 1).toISOString();
}
