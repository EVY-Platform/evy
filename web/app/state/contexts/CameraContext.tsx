import { createContext } from "react";

import type { useCamera } from "../../hooks/useCamera";

type CameraContextValue = ReturnType<typeof useCamera>;

export const CameraContext = createContext<CameraContextValue | null>(null);
