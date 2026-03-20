import { createContext, useContext } from "react";

import type { useCamera } from "../../hooks/useCamera";

export type CameraContextValue = ReturnType<typeof useCamera>;

export const CameraContext = createContext<CameraContextValue | null>(null);

export function useCameraContext(): CameraContextValue {
	const value = useContext(CameraContext);
	if (!value) {
		throw new Error("useCameraContext must be used within CanvasViewport");
	}
	return value;
}
