import { describe, expect, it } from "bun:test";
import {
	buildTransactionSignature,
	computeSignatureHash,
	verifyTransactionSignature,
} from "evy-types/paymentSignature";

const GOLDEN = {
	amount: 250,
	currency: "AUD",
	authorization_message_id: "95a6a85b-e289-471c-b7fe-440ec2dfa2dc",
	created_at: "2026-08-02T00:03:30",
	payment_provider: "stripe" as const,
	payment_method_last_4_characters: "4242",
};

const GOLDEN_HASH =
	"890787ccab9ec8eee374a6fa0ac834b3284663b47704662edd3a7e64cdf57d94";

describe("paymentSignature", () => {
	it("produces the golden SHA-256 hash for fixed inputs", () => {
		expect(computeSignatureHash(GOLDEN)).toBe(GOLDEN_HASH);
		expect(buildTransactionSignature(GOLDEN)).toEqual({
			data: GOLDEN,
			hash: GOLDEN_HASH,
		});
	});

	it("canonicalizes amount 250 and 250.0 identically", () => {
		expect(computeSignatureHash({ ...GOLDEN, amount: 250.0 })).toBe(
			GOLDEN_HASH,
		);
	});

	it("verifies a valid signature", () => {
		const signature = buildTransactionSignature(GOLDEN);
		expect(
			verifyTransactionSignature(
				signature,
				{
					amount: 250,
					currency: "AUD",
					authorization_message_id: GOLDEN.authorization_message_id,
				},
				"4242",
			),
		).toEqual({ ok: true });
	});

	it("rejects a tampered hash", () => {
		const signature = buildTransactionSignature(GOLDEN);
		const result = verifyTransactionSignature(
			{ ...signature, hash: "0".repeat(64) },
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id: GOLDEN.authorization_message_id,
			},
			"4242",
		);
		expect(result).toEqual({ ok: false, reason: "hash mismatch" });
	});

	it("rejects a tampered amount", () => {
		const signature = buildTransactionSignature({
			...GOLDEN,
			amount: 251,
		});
		const result = verifyTransactionSignature(
			signature,
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id: GOLDEN.authorization_message_id,
			},
			"4242",
		);
		expect(result).toEqual({ ok: false, reason: "amount mismatch" });
	});

	it("rejects a tampered currency", () => {
		const signature = buildTransactionSignature({
			...GOLDEN,
			currency: "USD",
		});
		const result = verifyTransactionSignature(
			signature,
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id: GOLDEN.authorization_message_id,
			},
			"4242",
		);
		expect(result).toEqual({ ok: false, reason: "currency mismatch" });
	});

	it("rejects a tampered created_at via hash", () => {
		const signature = buildTransactionSignature(GOLDEN);
		const tampered = {
			...signature,
			data: { ...signature.data, created_at: "2026-08-02T00:03:31" },
		};
		const result = verifyTransactionSignature(
			tampered,
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id: GOLDEN.authorization_message_id,
			},
			"4242",
		);
		expect(result).toEqual({ ok: false, reason: "hash mismatch" });
	});

	it("rejects a last-4 mismatch", () => {
		const signature = buildTransactionSignature({
			...GOLDEN,
			payment_method_last_4_characters: "1234",
		});
		const result = verifyTransactionSignature(
			signature,
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id: GOLDEN.authorization_message_id,
			},
			"4242",
		);
		expect(result).toEqual({
			ok: false,
			reason: "payment_method_last_4_characters mismatch",
		});
	});

	it("rejects an authorization_message_id mismatch", () => {
		const signature = buildTransactionSignature(GOLDEN);
		const result = verifyTransactionSignature(
			signature,
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id:
					"00000000-0000-0000-0000-000000000000",
			},
			"4242",
		);
		expect(result).toEqual({
			ok: false,
			reason: "authorization_message_id mismatch",
		});
	});

	it("rejects a non-stripe payment_provider", () => {
		const signature = buildTransactionSignature(GOLDEN);
		const tampered = {
			...signature,
			data: {
				...signature.data,
				payment_provider: "paypal" as "stripe",
			},
		};
		const result = verifyTransactionSignature(
			tampered,
			{
				amount: 250,
				currency: "AUD",
				authorization_message_id: GOLDEN.authorization_message_id,
			},
			"4242",
		);
		expect(result).toEqual({
			ok: false,
			reason: "payment_provider mismatch",
		});
	});
});
