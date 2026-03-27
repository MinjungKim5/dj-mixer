"use client";

import { createContext, useContext } from "react";

export const AUTO_CONFIG = {
  prerollSec: 8,
  fadeStartSec: 5,
  fadeDurationSec: 4,
};

interface AutoModeContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const AutoModeContext = createContext<AutoModeContextValue>({
  enabled: false,
  setEnabled: () => {},
});

export function useAutoMode() {
  return useContext(AutoModeContext);
}
