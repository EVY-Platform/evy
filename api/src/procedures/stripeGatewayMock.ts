import { MOCK_CAPTURE_FAILURE_AMOUNT } from "evy-types/paymentMocks";
import type { StripeCaptureOutcome, StripeGateway } from "./stripeGateway";

export function createMockStripeGateway(): StripeGateway {
	return {
		async createPaymentIntent() {
			return { id: `pi_mock_${crypto.randomUUID()}` };
		},
		async capturePaymentIntent(_id, amount): Promise<StripeCaptureOutcome> {
			if (amount === MOCK_CAPTURE_FAILURE_AMOUNT) {
				return { ok: false, reason: "mock capture failure" };
			}
			return { ok: true };
		},
	};
}
