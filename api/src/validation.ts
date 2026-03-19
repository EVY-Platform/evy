import {
	SDUI_FLOW_TYPE_VALUES,
	SDUI_ROW_TYPE_VALUES,
	type SDUI_Flow,
	type SDUI_Row,
} from "evy-types";
import { z } from "zod";

/**
 * Schema for a single row action item
 */
const RowActionSchema = z.strictObject({
	condition: z.string(),
	false: z.string(),
	true: z.string(),
});

/**
 * Schema for row action configuration
 */
const RowActionsSchema = z.array(RowActionSchema);

/**
 * Recursive row schema that validates the full row structure including nested children
 */
export const RowSchema: z.ZodType<SDUI_Row> = z.lazy(() =>
	z.strictObject({
		id: z.uuid(),
		type: z.enum(SDUI_ROW_TYPE_VALUES),
		view: z.strictObject({
			content: z.looseObject({
				title: z.string(),
				children: z.array(RowSchema).optional(),
				child: RowSchema.optional(),
				segments: z.array(z.string()).optional(),
			}),
			data: z.string().optional(),
			max_lines: z.string().optional(),
		}),
		destination: z.string().optional(),
		actions: RowActionsSchema.default([]),
	}),
);

/**
 * Schema for a page within a flow
 */
export const PageSchema = z.strictObject({
	id: z.uuid(),
	title: z.string(),
	rows: z.array(RowSchema),
	footer: RowSchema.optional(),
});

/**
 * Schema for the complete flow data structure.
 * Pages may be an empty array per SDUI_Flow schema.
 */
const FlowDataSchema: z.ZodType<SDUI_Flow> = z.strictObject({
	id: z.uuid(),
	name: z.string().min(1, { error: "Flow name is required" }),
	type: z.enum(SDUI_FLOW_TYPE_VALUES),
	data: z.string(),
	pages: z.array(PageSchema),
});

export function formatZodErrors(issues: z.core.$ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
}

export function validateFlowData(data: unknown): SDUI_Flow {
	const result = FlowDataSchema.safeParse(data);

	if (!result.success) {
		throw new Error(
			`Flow validation failed: ${formatZodErrors(result.error.issues)}`,
		);
	}

	return result.data;
}
