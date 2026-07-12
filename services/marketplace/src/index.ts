import { startMarketplaceRpcServer, stopMarketplaceRpcServer } from "./rpc";

async function main() {
	await startMarketplaceRpcServer();

	const shutdown = (signal: NodeJS.Signals) => {
		console.info(
			`Received ${signal}, stopping Marketplace JSON-RPC server`,
		);
		stopMarketplaceRpcServer();
		process.exit(0);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
