import { z } from "zod";

/**
 * Valid row types supported by the SDUI framework
 */
const VALID_ROW_TYPES = [
	"Button",
	"Calendar",
	"ColumnContainer",
	"Dropdown",
	"Info",
	"InlinePicker",
	"InputList",
	"Input",
	"ListContainer",
	"Search",
	"SelectPhoto",
	"SelectSegmentContainer",
	"SheetContainer",
	"TextAction",
	"TextArea",
	"Text",
	"TextSelect",
] as const;

/**
 * Schema for row validation rules
 */
const RowValidationSchema = z
	.object({
		required: z.string().optional(),
		message: z.string().optional(),
		minAmount: z.string().optional(),
		minValue: z.string().optional(),
		minCharacters: z.string().optional(),
	})
	.strict();

/**
 * Schema for row edit configuration
 */
const RowEditSchema = z
	.object({
		destination: z.string().optional(),
		validation: RowValidationSchema.optional(),
	})
	.strict();

/**
 * Schema for row action configuration
 */
const RowActionSchema = z
	.object({
		target: z.string(),
	})
	.strict();

/**
 * Base content schema - title is required, other fields are flexible
 * Uses passthrough to allow additional string fields (like label, text, placeholder, etc.)
 */
const BaseContentSchema = z
	.object({
		title: z.string(),
	})
	.passthrough();

/**
 * Recursive row schema that validates the full row structure including nested children
 */
type RowInput = {
	id: string;
	type: string;
	view: {
		content: {
			title: string;
			children?: RowInput[];
			child?: RowInput;
			segments?: string[];
			[key: string]: unknown;
		};
		data?: string;
		max_lines?: string;
	};
	edit?: {
		destination?: string;
		validation?: {
			required?: string;
			message?: string;
			minAmount?: string;
			minValue?: string;
			minCharacters?: string;
		};
	};
	action?: {
		target: string;
	};
};

export const RowSchema: z.ZodType<RowInput> = z.lazy(() =>
	z
		.object({
			id: z.string().uuid(),
			type: z.enum(VALID_ROW_TYPES),
			view: z
				.object({
					content: z
						.object({
							title: z.string(),
							children: z.array(RowSchema).optional(),
							child: RowSchema.optional(),
							segments: z.array(z.string()).optional(),
						})
						.passthrough(),
					data: z.string().optional(),
					max_lines: z.string().optional(),
				})
				.strict(),
			edit: RowEditSchema.optional(),
			action: RowActionSchema.optional(),
		})
		.strict(),
);

/**
 * Schema for a page within a flow
 */
export const PageSchema = z
	.object({
		id: z.string().uuid(),
		title: z.string(),
		rows: z.array(RowSchema),
		footer: RowSchema.optional(),
	})
	.strict();

/**
 * Valid flow types
 */
const VALID_FLOW_TYPES = ["read", "write", "create", "update", "delete"] as const;

/**
 * Schema for the complete flow data structure
 */
export const FlowDataSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1, "Flow name is required"),
		type: z.enum(VALID_FLOW_TYPES),
		data: z.string(),
		pages: z.array(PageSchema).min(1, "Flow must have at least one page"),
	})
	.strict();

/**
 * Type inferred from the FlowDataSchema
 */
export type ValidatedFlowData = z.infer<typeof FlowDataSchema>;

/**
 * Validates flow data and returns the validated data or throws an error
 * with a descriptive message about what failed validation
 */
export function validateFlowData(data: unknown): ValidatedFlowData {
	const result = FlowDataSchema.safeParse(data);

	if (!result.success) {
		const errorMessages = result.error.errors
			.map((err) => {
				const path = err.path.join(".");
				return path ? `${path}: ${err.message}` : err.message;
			})
			.join("; ");
		throw new Error(`Flow validation failed: ${errorMessages}`);
	}

	return result.data;
}
