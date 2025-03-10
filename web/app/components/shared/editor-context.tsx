import { createContext, useContext } from "react";

import invariant from "tiny-invariant";

import type { PageData, RegisterRowArgs } from "./registry.tsx";

export type EditorContextValue = {
	getPages: () => PageData[];

	reorderRow: (args: {
		pageId: string;
		startIndex: number;
		finishIndex: number;
	}) => void;

	moveRow: (args: {
		startPageId: string;
		finishPageId: string;
		itemIndexInStartPage: number;
		itemIndexInFinishPage?: number;
	}) => void;

	registerRow: (args: RegisterRowArgs) => () => void;

	instanceId: symbol;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
	const value = useContext(EditorContext);
	invariant(value, "cannot find EditorContext provider");
	return value;
}
