"use client";

import { useState } from "react";
import { AutoModeContext } from "../lib/automode";

export default function AutoModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);

  return (
    <AutoModeContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </AutoModeContext.Provider>
  );
}
