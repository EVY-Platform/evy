import { createContext, useContext } from "react";

import invariant from "tiny-invariant";

export type PageContextProps = {
	pageId: string;
	getRowIndex: (userId: string) => number;
	getNumRows: () => number;
};

export const PageContext = createContext<PageContextProps | null>(null);

export function usePageContext(): PageContextProps {
	const value = useContext(PageContext);
	invariant(value, "cannot find PageContext provider");
	return value;
}
