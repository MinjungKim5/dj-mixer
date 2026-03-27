"use client";

interface CrossfaderProps {
  value: number; // -1 (A) ~ 0 (center) ~ 1 (B)
  onChange: (value: number) => void;
}

export default function Crossfader({ value, onChange }: CrossfaderProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-6 py-4">
      <span className="text-sm font-bold text-foreground/60">A</span>
      <div className="relative flex flex-1 items-center">
        {/* 눈금 */}
        <div className="pointer-events-none absolute inset-x-0 flex justify-between px-[8px]">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className={`bg-foreground/20 ${
                i % 5 === 0 ? "h-2.5 w-px" : "h-1.5 w-px"
              }`}
            />
          ))}
        </div>
        {/* 슬라이더 */}
        <input
          type="range"
          min={-100}
          max={100}
          value={value * 100}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="dj-slider relative z-10 w-full"
        />
      </div>
      <span className="text-sm font-bold text-foreground/60">B</span>
    </div>
  );
}
