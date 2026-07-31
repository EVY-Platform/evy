import { describe, expect, test } from "bun:test";

import {
	MESSAGE_DESTINATION_ADDRESS,
	SEEDED_AMAZING_FRIDGE_PICKUP_ADDRESS_ROW,
	SEEDED_MARTIN_PLACE_PICKUP_ADDRESS_ROW,
} from "./fixtures/canonicalAddresses";
import serviceData from "./fixtures/services/service_data.json";

type SeedMessage = {
	id: string;
	data?: Record<string, unknown>;
	parent_message_id?: string;
};

const messages = (serviceData as { "evy.messages": SeedMessage[] })[
	"evy.messages"
];

function messageData(id: string): Record<string, unknown> {
	const message = messages.find((row) => row.id === id);
	expect(message).toBeDefined();
	return message?.data ?? {};
}

describe("seeded messages carry transfer addresses", () => {
	test("delivery requests include destination_address", () => {
		const deliveryRequests = messages.filter(
			(message) =>
				message.data?.type === "delivery" &&
				message.data?.value === "pending",
		);
		expect(deliveryRequests.length).toBeGreaterThan(0);
		for (const message of deliveryRequests) {
			expect(message.data?.destination_address).toEqual(
				MESSAGE_DESTINATION_ADDRESS,
			);
		}
	});

	test("shipping requests include destination_address", () => {
		const shippingRequests = messages.filter(
			(message) =>
				message.data?.type === "shipping" &&
				message.data?.value === "pending",
		);
		expect(shippingRequests.length).toBeGreaterThan(0);
		for (const message of shippingRequests) {
			expect(message.data?.destination_address).toEqual(
				MESSAGE_DESTINATION_ADDRESS,
			);
		}
	});

	test("pickup accept messages include pickup_address", () => {
		const pickupAccepts = messages.filter(
			(message) =>
				message.data?.type === "pickup" &&
				message.data?.value === "accept",
		);
		expect(pickupAccepts.length).toBeGreaterThan(0);
		for (const message of pickupAccepts) {
			expect([
				SEEDED_AMAZING_FRIDGE_PICKUP_ADDRESS_ROW,
				SEEDED_MARTIN_PLACE_PICKUP_ADDRESS_ROW,
			]).toContainEqual(message.data?.pickup_address);
		}
	});

	test("seed data has no bare pickup pending requests", () => {
		const barePickupPending = messages.filter(
			(message) =>
				message.data?.type === "pickup" &&
				message.data?.value === "pending",
		);
		expect(barePickupPending).toEqual([]);
	});

	test("delivery accept forwards destination_address from its request", () => {
		const requestData = messageData("dfc53233-6152-4878-bf4f-b11a47c636ac");
		const acceptData = messageData("b0897a47-c45c-4e9c-8021-8ec3bdcac59c");
		expect(acceptData.destination_address).toEqual(
			requestData.destination_address,
		);
	});
});
