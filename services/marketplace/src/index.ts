import { startMarketplaceRpcServer, stopMarketplaceRpcServer } from "./rpc";

async function main() {
	await startMarketplaceRpcServer();

	const shutdown = () => {
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
