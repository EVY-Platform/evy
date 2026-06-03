type TemporalDatetimeLike = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	dayOfWeek: number;
};

declare const Temporal: {
	Instant: {
		from(value: string): {
			toZonedDateTimeISO(timeZone: string): TemporalDatetimeLike;
		};
	};
	PlainDateTime: {
		from(value: string): TemporalDatetimeLike;
	};
};
