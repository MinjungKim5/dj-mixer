"use client";

import type { Track } from "../lib/types";

interface QueueProps {
  tracks: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export default function Queue({
  tracks,
  currentIndex,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: QueueProps) {
  if (tracks.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-foreground/40">
        큐가 비어있습니다. URL을 입력하여 트랙을 추가하세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {tracks.map((track, i) => (
        <li
          key={`${track.videoId}-${i}`}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer ${
            i === currentIndex
              ? "bg-foreground/15 font-medium"
              : "hover:bg-foreground/5"
          }`}
          onClick={() => onSelect(i)}
        >
          {/* 트랙 번호 & 재생 표시 */}
          <span className="w-5 shrink-0 text-center text-xs text-foreground/50">
            {i === currentIndex ? "▶" : i + 1}
          </span>

          {/* 제목 */}
          <span className="flex-1 truncate">{track.title}</span>

          {/* 컨트롤 버튼 */}
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp(i);
              }}
              disabled={i === 0}
              className="rounded p-0.5 text-xs text-foreground/40 hover:text-foreground disabled:opacity-20"
              aria-label="위로 이동"
            >
              ▲
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown(i);
              }}
              disabled={i === tracks.length - 1}
              className="rounded p-0.5 text-xs text-foreground/40 hover:text-foreground disabled:opacity-20"
              aria-label="아래로 이동"
            >
              ▼
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              className="rounded p-0.5 text-xs text-foreground/40 hover:text-red-500"
              aria-label="삭제"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
