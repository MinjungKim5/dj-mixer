"use client";

import { useState } from "react";
import TrackInput from "./TrackInput";
import type { Track } from "../lib/types";

interface QueueProps {
  tracks: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddTrack: (tracks: Track[]) => void;
}

export default function Queue({
  tracks,
  currentIndex,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  onReorder,
  onAddTrack,
}: QueueProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 상단: TrackInput */}
      <TrackInput onAddTrack={onAddTrack} />

      {/* 트랙 목록 */}
      {tracks.length === 0 ? (
        <p className="py-4 text-center text-xs text-foreground/40">
          큐가 비어있습니다. URL을 입력하여 트랙을 추가하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tracks.map((track, i) => {
            const isCurrent = i === currentIndex;
            const isDragging = i === dragIndex;
            const isDragOver = i === dragOverIndex && dragIndex !== null && dragIndex !== i;

            return (
              <li
                key={`${track.videoId}-${i}`}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors cursor-pointer ${
                  isCurrent
                    ? "border-l-2 border-green-500 bg-foreground/15 font-medium"
                    : "border-l-2 border-transparent hover:bg-foreground/5"
                } ${isDragging ? "opacity-50" : ""} ${
                  isDragOver ? "ring-1 ring-foreground/30" : ""
                }`}
                onClick={() => onSelect(i)}
              >
                {/* 드래그 핸들 */}
                <span className="cursor-grab text-sm text-foreground/30 active:cursor-grabbing">
                  ⠿
                </span>

                {/* 트랙 번호 & 재생 표시 */}
                <span className="w-6 shrink-0 text-center text-sm text-foreground/50">
                  {isCurrent ? "▶" : i + 1}
                </span>

                {/* 썸네일 */}
                {track.thumbnail && (
                  <img
                    src={track.thumbnail}
                    alt=""
                    className="h-10 w-14 rounded object-cover shrink-0"
                    draggable={false}
                  />
                )}

                {/* 제목 */}
                <span className="flex-1 truncate text-sm">{track.title}</span>

                {/* 컨트롤 버튼 */}
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp(i);
                    }}
                    disabled={i === 0}
                    className="rounded p-1 text-sm text-foreground/40 hover:text-foreground disabled:opacity-20"
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
                    className="rounded p-1 text-sm text-foreground/40 hover:text-foreground disabled:opacity-20"
                    aria-label="아래로 이동"
                  >
                    ▼
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(i);
                    }}
                    className="rounded p-1 text-sm text-foreground/40 hover:text-red-500"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
