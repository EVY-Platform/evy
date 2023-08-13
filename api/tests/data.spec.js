import { validateAuth, deviceTokens } from "../dist/data.js";
import { expect } from "chai";

describe("Data helper test suite", () => {
	deviceTokens.push("good");

	const validateAuthTests = [
		{
			should: "return false when empty token and os",
			token: null,
			os: null,
			expected: false,
		},
		{
			should: "return false when bad token and os",
			token: "bad",
			os: "bad",
			expected: false,
		},
		{
			should: "return false when good token and bad os",
			token: "good",
			os: "bad",
			expected: false,
		},
		{
			should: "return true when good token and os",
			token: "good",
			os: "ios",
			expected: true,
		},
		{
			should: "return true when new token and good os",
			token: "new",
			os: "ios",
			expected: true,
		},
	];
	validateAuthTests.forEach((test) => {
		it(`should ${test.should}`, () => {
			expect(validateAuth(test.token, test.os)).to.equal(test.expected);
		});
	});
});
