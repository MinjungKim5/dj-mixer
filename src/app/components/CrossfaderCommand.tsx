"use client";

import { useState, useRef, useCallback } from "react";

interface CrossfaderCommandProps {
  crossfader: number;
  onChange: (value: number) => void;
}

export default function CrossfaderCommand({
  crossfader,
  onChange,
}: CrossfaderCommandProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
  }, []);

  function normalize(cmd: string): string {
    // 한글 키 매핑: ㅣ→l, ㄱ→r, ㅡ→m
    return cmd
      .trim()
      .replace(/[ㅣL]/g, "l")
      .replace(/[ㄱR]/g, "r")
      .replace(/[ㅡM]/g, "m")
      .toLowerCase()
      .replace(":", ""); // 콜론 허용하되 제거 (l:30 = l30)
  }

  function execute(cmd: string) {
    const trimmed = normalize(cmd);
    setError("");
    stopAnimation();

    // l, r, m 또는 l30, r10, m15 (숫자 = 100ms 단위)
    const match = trimmed.match(/^([lrm])(\d+)?$/);
    if (!match) {
      setError("형식: l30, r10, m, ㅣ30, ㄱ10, ㅡ");
      return;
    }

    const direction = match[1] as "l" | "r" | "m";
    const ticks = match[2] ? parseInt(match[2], 10) : 0;
    const target = direction === "l" ? -1 : direction === "r" ? 1 : 0;

    if (ticks === 0) {
      onChange(target);
      setInput("");
      return;
    }
    const durationMs = ticks * 100;
    const steps = Math.max(1, Math.round(durationMs / 16)); // ~60fps
    const intervalMs = durationMs / steps;

    // 현재값에서 target까지 애니메이션
    let step = 0;
    const startValue = crossfader;
    const delta = target - startValue;

    animRef.current = setInterval(() => {
      step++;
      if (step >= steps) {
        onChange(target);
        stopAnimation();
      } else {
        const progress = step / steps;
        // ease-in-out
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        onChange(
          Math.round((startValue + delta * eased) * 1000) / 1000
        );
      }
    }, intervalMs);

    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      execute(input);
    } else if (e.key === "Escape") {
      stopAnimation();
      setInput("");
      setError("");
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-foreground/40">CMD</span>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="l30, r10, m"
          className="w-32 rounded border border-foreground/20 bg-foreground/5 px-2 py-1 text-center text-xs font-mono text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
        />
        {animRef.current && (
          <button
            onClick={stopAnimation}
            className="text-[10px] text-red-400 hover:text-red-300"
          >
            stop
          </button>
        )}
      </div>
      {error && (
        <span className="text-[9px] text-red-400">{error}</span>
      )}
    </div>
  );
}
