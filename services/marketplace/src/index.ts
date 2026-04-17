import { startMarketplaceGrpcServer } from "./grpc";

async function main() {
	await startMarketplaceGrpcServer();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
