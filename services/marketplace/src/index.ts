import { startMarketplaceGrpcServer } from "./grpc/server";

startMarketplaceGrpcServer().catch((err) => {
	console.error(err);
	process.exit(1);
});
