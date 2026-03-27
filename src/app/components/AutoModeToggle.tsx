"use client";

import { useAutoMode } from "../lib/automode";

export default function AutoModeToggle() {
  const { enabled, setEnabled } = useAutoMode();

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`rounded-lg border px-2.5 py-1.5 text-base transition-all ${
        enabled
          ? "border-green-500/50 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
          : "border-foreground/20 bg-foreground/5 hover:bg-foreground/10"
      }`}
      aria-label={enabled ? "자동 재생 모드 끄기" : "자동 재생 모드 켜기"}
      title="Auto Mode"
    >
      📼
    </button>
  );
}
