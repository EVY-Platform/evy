import type {
	ConditionExpression,
	ConditionGroup,
} from "../../utils/actionHelpers";

export function ensureGroup(expr: ConditionExpression | null): ConditionGroup {
	if (!expr) {
		return { type: "group", logicalOperator: "or", children: [] };
	}
	if (expr.type === "group") return expr;
	return { type: "group", logicalOperator: "or", children: [expr] };
}

export function normalizeExpression(
	group: ConditionGroup,
): ConditionExpression | null {
	if (group.children.length === 0) return null;
	if (group.children.length === 1) return group.children[0];
	return group;
}
