"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg transition-colors hover:bg-white/20 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20"
      aria-label="테마 전환"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
