export function isoDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function mockDatesFromToday(count: number): string[] {
	const today = new Date();
	return Array.from({ length: count }, (_, index) => {
		const date = new Date(today);
		date.setDate(today.getDate() + index);
		return isoDateString(date);
	});
}
