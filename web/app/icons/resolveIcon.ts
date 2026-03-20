import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

function kebabToPascal(name: string): string {
	return name
		.split("-")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
}

export default function resolveIcon(name: string): LucideIcon | undefined {
	const key = kebabToPascal(name);
	const icon = (LucideIcons as Record<string, unknown>)[key];
	// Lucide exports are forwardRef objects (`typeof === "object"`), not plain functions.
	if (icon != null && typeof icon === "object" && "$$typeof" in icon) {
		return icon as LucideIcon;
	}
	return undefined;
}
