import {
	MOCK_CAPTURE_FAILURE_AMOUNT,
	MOCK_TRANSFER_FAILURE_AMOUNT,
} from "evy-types/paymentMocks";
import type { StripeGateway } from "./stripeGateway";

export function createMockStripeGateway(): StripeGateway {
	return {
		async createPaymentIntent() {
			return { id: `pi_mock_${crypto.randomUUID()}` };
		},
		async capturePaymentIntent(_id, amount) {
			if (amount === MOCK_CAPTURE_FAILURE_AMOUNT) {
				return { ok: false, reason: "mock capture failure" };
			}
			return { ok: true };
		},
		async createTransfer(params) {
			if (params.amount === MOCK_TRANSFER_FAILURE_AMOUNT) {
				return { ok: false, reason: "mock transfer failure" };
			}
			return { ok: true };
		},
	};
}
