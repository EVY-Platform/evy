import { createHash } from "node:crypto";
import type { DATA_EVY_TransactionSignature } from "./generated/ts/data/data";

export type TransactionSignatureData = DATA_EVY_TransactionSignature["data"];
export type TransactionSignature = DATA_EVY_TransactionSignature;

export type SignatureVerifyParams = {
	amount: number;
	currency: string;
	authorization_message_id: string;
};

export type SignatureVerifyResult =
	| { ok: true }
	| { ok: false; reason: string };

const SIGNATURE_VERSION_PREFIX = "evy-txn-sig-v1";

export function formatSignatureAmount(amount: number): string {
	return amount.toFixed(2);
}

export function canonicalSignatureString(
	data: TransactionSignatureData,
): string {
	return [
		SIGNATURE_VERSION_PREFIX,
		formatSignatureAmount(data.amount),
		data.currency,
		data.authorization_message_id,
		data.created_at,
		data.payment_provider,
		data.payment_method_last_4_characters,
	].join("\n");
}

export function computeSignatureHash(data: TransactionSignatureData): string {
	return createHash("sha256")
		.update(canonicalSignatureString(data), "utf8")
		.digest("hex");
}

export function buildTransactionSignature(
	data: TransactionSignatureData,
): TransactionSignature {
	return {
		data,
		hash: computeSignatureHash(data),
	};
}

export function verifyTransactionSignature(
	signature: TransactionSignature,
	params: SignatureVerifyParams,
	last4: string,
): SignatureVerifyResult {
	if (
		formatSignatureAmount(signature.data.amount) !==
		formatSignatureAmount(params.amount)
	) {
		return { ok: false, reason: "amount mismatch" };
	}
	if (signature.data.currency !== params.currency) {
		return { ok: false, reason: "currency mismatch" };
	}
	if (
		signature.data.authorization_message_id !==
		params.authorization_message_id
	) {
		return { ok: false, reason: "authorization_message_id mismatch" };
	}
	if (signature.data.payment_provider !== "stripe") {
		return { ok: false, reason: "payment_provider mismatch" };
	}
	if (computeSignatureHash(signature.data) !== signature.hash) {
		return { ok: false, reason: "hash mismatch" };
	}
	if (signature.data.payment_method_last_4_characters !== last4) {
		return {
			ok: false,
			reason: "payment_method_last_4_characters mismatch",
		};
	}
	return { ok: true };
}
