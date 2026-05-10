import { createContext, useContext, type ReactNode } from "react";

const IsRowsPanelContext = createContext(false);

export function RowsPanelProvider({ children }: { children: ReactNode }) {
	return (
		<IsRowsPanelContext.Provider value={true}>
			{children}
		</IsRowsPanelContext.Provider>
	);
}

export function useIsInRowsPanel(): boolean {
	return useContext(IsRowsPanelContext);
}
