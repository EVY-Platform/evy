import { describe, expect, it } from "bun:test";
import { RateLimitError, RateLimiter } from "../procedures/rateLimit";

function fixedClock(startAt = 0) {
	let now = startAt;
	return {
		now: () => now,
		advance: (ms: number) => {
			now += ms;
		},
	};
}

describe("rate limiter", () => {
	it("allows calls up to the limit and rejects the next one", () => {
		const clock = fixedClock();
		const limiter = new RateLimiter(clock.now);

		for (let i = 0; i < 3; i++) {
			limiter.consume("socket-1", "place_search", 3);
		}

		expect(() => limiter.consume("socket-1", "place_search", 3)).toThrow(
			RateLimitError,
		);
	});

	it("does not track procedures declared without a limit", () => {
		const limiter = new RateLimiter(fixedClock().now);
		for (let i = 0; i < 500; i++) {
			limiter.consume("socket-1", "sync", null);
		}
		// No assertion beyond not throwing: unmetered means unmetered.
	});

	it("counts each caller separately", () => {
		const limiter = new RateLimiter(fixedClock().now);
		limiter.consume("socket-1", "place_search", 1);

		expect(() =>
			limiter.consume("socket-2", "place_search", 1),
		).not.toThrow();
		expect(() => limiter.consume("socket-1", "place_search", 1)).toThrow(
			RateLimitError,
		);
	});

	it("counts each procedure separately", () => {
		const limiter = new RateLimiter(fixedClock().now);
		limiter.consume("socket-1", "place_search", 1);

		expect(() => limiter.consume("socket-1", "other", 1)).not.toThrow();
	});

	it("lets the caller through again once the window rolls over", () => {
		const clock = fixedClock();
		const limiter = new RateLimiter(clock.now);
		limiter.consume("socket-1", "place_search", 1);
		expect(() => limiter.consume("socket-1", "place_search", 1)).toThrow(
			RateLimitError,
		);

		clock.advance(60_000);

		expect(() =>
			limiter.consume("socket-1", "place_search", 1),
		).not.toThrow();
	});

	it("reports how long the caller has to wait", () => {
		const clock = fixedClock();
		const limiter = new RateLimiter(clock.now);
		limiter.consume("socket-1", "place_search", 1);
		clock.advance(15_000);

		try {
			limiter.consume("socket-1", "place_search", 1);
			throw new Error("expected a rate limit error");
		} catch (error) {
			expect(error).toBeInstanceOf(RateLimitError);
			expect((error as RateLimitError).retryAfterMs).toBe(45_000);
		}
	});

	it("forgets a caller's counters when its socket goes away", () => {
		const limiter = new RateLimiter(fixedClock().now);
		limiter.consume("socket-1", "place_search", 1);

		limiter.forget("socket-1");

		expect(() =>
			limiter.consume("socket-1", "place_search", 1),
		).not.toThrow();
	});
});
