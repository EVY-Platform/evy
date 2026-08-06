import type { DATA_EVY_Transaction } from "evy-types";
import { transaction } from "evy-types/db/schema.generated";
import { validateDataEvyTransaction } from "evy-types/validators";
import { makeCoreResource } from "./coreResource";

// type/status transitions are append-only (new rows), not in-place updates,
// so no toUpdateSet: update and delete stay unregistered in the RPC registry.
export const transactionsResource = makeCoreResource<DATA_EVY_Transaction>({
	table: transaction,
	validate: validateDataEvyTransaction,
});
