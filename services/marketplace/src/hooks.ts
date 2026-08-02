import type { HookRequest, HookResponse } from "evy-types";

export function handleHook(params: HookRequest): HookResponse {
	switch (params.hook) {
		case "before_create":
			return { ok: true };
		case "after_create":
			console.info(
				`[marketplace] ${params.operation} on ${params.resource}`,
				params.data,
			);
			return { ok: true };
	}
}
