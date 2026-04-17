import { startMarketplaceGrpcServer, stopMarketplaceGrpcServer } from "./grpc";

async function main() {
	await startMarketplaceGrpcServer();

	const shutdown = (signal: NodeJS.Signals) => {
		console.info(`Received ${signal}, stopping Marketplace gRPC server`);
		stopMarketplaceGrpcServer();
		process.exit(0);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
