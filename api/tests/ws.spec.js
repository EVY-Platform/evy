import { expect } from "chai";

function mockAuthHandler() {
	return true;
}

import { initServer } from "../dist/ws.js";
import { Client } from "rpc-websockets";

describe("WS helper test suite", () => {
	it(`should start a websocket server`, () => {
		return initServer(mockAuthHandler)
			.then((server) => {
				var client = new Client(
					`ws://localhost:${process.env.API_PORT}`,
				);

				return new Promise((resolve, reject) => {
					client.on("open", function () {
						resolve();
					});
					client.on("error", function (e) {
						console.error(e);
						reject();
					});
				})
					.then(() => {
						client.close();
						server.close();
					})
					.catch((e) => {
						client.close();
						server.close();
						throw e;
					});
			})
			.then(expect);
	});
});
