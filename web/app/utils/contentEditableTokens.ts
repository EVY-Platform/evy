import type { IdDisplayPart } from "./idCandidates";

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function buildTokenHtml(parts: IdDisplayPart[]): string {
	return parts
		.map((part) => {
			if (part.type === "text") return escapeHtml(part.text);
			if (part.type === "attribute") {
				return `<span class="evy-id-autocomplete-token evy-id-autocomplete-inline-token evy-id-autocomplete-inline-attribute">${escapeHtml(part.text)}</span>`;
			}
			return `<span class="evy-id-autocomplete-token evy-id-autocomplete-inline-token" data-value="${part.rawId}" contenteditable="false">${escapeHtml(part.displayName)}</span>`;
		})
		.join("");
}

export function readRawValueFromNode(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE)
		return (node.textContent ?? "").replace(/\u00a0/g, " ");
	if (node instanceof HTMLElement && node.dataset.value)
		return node.dataset.value;

	let result = "";
	for (const childNode of node.childNodes) {
		result += readRawValueFromNode(childNode);
	}
	return result;
}

export function getRawCursorIndexFromEditable(el: HTMLDivElement): number {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return readRawValueFromNode(el).length;
	}

	const range = selection.getRangeAt(0);
	if (!el.contains(range.startContainer)) {
		return readRawValueFromNode(el).length;
	}

	let rawIndex = 0;
	let foundCursor = false;

	function walk(node: Node) {
		if (foundCursor) return;

		if (node === range.startContainer) {
			if (node.nodeType === Node.TEXT_NODE) {
				rawIndex += Math.min(
					range.startOffset,
					node.textContent?.length ?? 0,
				);
			} else {
				const childNodes = Array.from(node.childNodes);
				for (const childNode of childNodes.slice(
					0,
					range.startOffset,
				)) {
					rawIndex += readRawValueFromNode(childNode).length;
				}
			}
			foundCursor = true;
			return;
		}

		if (node instanceof HTMLElement && node.dataset.value) {
			rawIndex += node.dataset.value.length;
			return;
		}

		if (node.nodeType === Node.TEXT_NODE) {
			rawIndex += node.textContent?.length ?? 0;
			return;
		}

		for (const childNode of node.childNodes) {
			walk(childNode);
		}
	}

	walk(el);
	return rawIndex;
}

export function setEditableCursorAtRawIndex(
	el: HTMLDivElement,
	cursorIndex: number,
) {
	const selection = window.getSelection();
	if (!selection) return;

	const range = document.createRange();
	let remaining = Math.max(cursorIndex, 0);
	let placedCursor = false;

	function walk(node: Node) {
		if (placedCursor) return;

		if (node.nodeType === Node.TEXT_NODE) {
			const textLength = node.textContent?.length ?? 0;
			if (remaining <= textLength) {
				range.setStart(node, remaining);
				placedCursor = true;
				return;
			}
			remaining -= textLength;
			return;
		}

		if (node instanceof HTMLElement && node.dataset.value) {
			const tokenLength = node.dataset.value.length;
			if (remaining === 0) {
				range.setStartBefore(node);
				placedCursor = true;
				return;
			}
			if (remaining < tokenLength) {
				range.setStartAfter(node);
				placedCursor = true;
				return;
			}
			remaining -= tokenLength;
			return;
		}

		for (const childNode of node.childNodes) {
			walk(childNode);
		}
	}

	for (const childNode of el.childNodes) {
		walk(childNode);
	}

	if (!placedCursor) {
		range.selectNodeContents(el);
		range.collapse(false);
	} else {
		range.collapse(true);
	}

	selection.removeAllRanges();
	selection.addRange(range);
}
