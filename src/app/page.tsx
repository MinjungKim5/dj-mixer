"use client";

import { useState, useCallback, useRef } from "react";
import DjDeck from "./components/DjDeck";
import Queue from "./components/Queue";
import Crossfader from "./components/Crossfader";
import type { DeckId, Track } from "./lib/types";
import { sendProjection } from "./lib/projection";

interface DeckState {
  queue: Track[];
  currentIndex: number;
  volume: number; // 개별 볼륨 0~100
}

const initialDeck: DeckState = {
  queue: [],
  currentIndex: -1,
  volume: 100,
};

function calcEffectiveVolume(
  deckVolume: number,
  crossfader: number,
  side: "A" | "B"
): number {
  let ratio = 1;
  if (side === "A" && crossfader > 0) {
    ratio = 1 - crossfader;
  } else if (side === "B" && crossfader < 0) {
    ratio = 1 + crossfader;
  }
  return Math.round(deckVolume * ratio);
}

export default function Home() {
  const [deckA, setDeckA] = useState<DeckState>(initialDeck);
  const [deckB, setDeckB] = useState<DeckState>(initialDeck);
  const [crossfader, setCrossfader] = useState(0);
  const [projectDeck, setProjectDeck] = useState<DeckId | null>(null);
  const projWindowRef = useRef<Window | null>(null);

  // 프로젝션 창 열기
  function openProjection() {
    if (projWindowRef.current && !projWindowRef.current.closed) {
      projWindowRef.current.focus();
      return;
    }
    projWindowRef.current = window.open(
      "/projection",
      "dj-projection",
      "popup"
    );
  }

  // 프로젝션 덱 전환
  function toggleProjectDeck(deckId: DeckId) {
    if (projectDeck === deckId) {
      setProjectDeck(null);
      sendProjection({ type: "stop" });
    } else {
      setProjectDeck(deckId);
      const deck = deckId === "A" ? deckA : deckB;
      if (deck.currentIndex >= 0 && deck.queue[deck.currentIndex]) {
        sendProjection({
          type: "load",
          videoId: deck.queue[deck.currentIndex].videoId,
        });
      }
    }
  }

  // --- 트랙 추가 ---
  const handleAddTrackA = useCallback(
    (tracks: Track[]) =>
      setDeckA((prev) => {
        const newQueue = [...prev.queue, ...tracks];
        const newIndex = prev.currentIndex === -1 ? 0 : prev.currentIndex;
        return { ...prev, queue: newQueue, currentIndex: newIndex };
      }),
    []
  );
  const handleAddTrackB = useCallback(
    (tracks: Track[]) =>
      setDeckB((prev) => {
        const newQueue = [...prev.queue, ...tracks];
        const newIndex = prev.currentIndex === -1 ? 0 : prev.currentIndex;
        return { ...prev, queue: newQueue, currentIndex: newIndex };
      }),
    []
  );

  // --- 덱 A 핸들러 ---
  const handleDeckAIndexChange = useCallback(
    (currentIndex: number) => setDeckA((prev) => ({ ...prev, currentIndex })),
    []
  );
  const handleDeckAVolumeChange = useCallback(
    (volume: number) => setDeckA((prev) => ({ ...prev, volume })),
    []
  );
  const handleDeckATitleUpdate = useCallback(
    (index: number, title: string) =>
      setDeckA((prev) => {
        const queue = [...prev.queue];
        if (queue[index]) queue[index] = { ...queue[index], title };
        return { ...prev, queue };
      }),
    []
  );

  // --- 덱 B 핸들러 ---
  const handleDeckBIndexChange = useCallback(
    (currentIndex: number) => setDeckB((prev) => ({ ...prev, currentIndex })),
    []
  );
  const handleDeckBVolumeChange = useCallback(
    (volume: number) => setDeckB((prev) => ({ ...prev, volume })),
    []
  );
  const handleDeckBTitleUpdate = useCallback(
    (index: number, title: string) =>
      setDeckB((prev) => {
        const queue = [...prev.queue];
        if (queue[index]) queue[index] = { ...queue[index], title };
        return { ...prev, queue };
      }),
    []
  );

  // --- 큐 조작 (공통 팩토리) ---
  function makeQueueHandlers(
    setter: React.Dispatch<React.SetStateAction<DeckState>>
  ) {
    return {
      onSelect: (index: number) =>
        setter((prev) => ({ ...prev, currentIndex: index })),
      onRemove: (index: number) =>
        setter((prev) => {
          const newQueue = prev.queue.filter((_, i) => i !== index);
          let newIndex = prev.currentIndex;
          if (index === prev.currentIndex) {
            newIndex =
              newQueue.length > 0
                ? Math.min(index, newQueue.length - 1)
                : -1;
          } else if (index < prev.currentIndex) {
            newIndex = prev.currentIndex - 1;
          }
          return { ...prev, queue: newQueue, currentIndex: newIndex };
        }),
      onMoveUp: (index: number) =>
        setter((prev) => {
          if (index === 0) return prev;
          const newQueue = [...prev.queue];
          [newQueue[index - 1], newQueue[index]] = [
            newQueue[index],
            newQueue[index - 1],
          ];
          let newIndex = prev.currentIndex;
          if (prev.currentIndex === index) newIndex = index - 1;
          else if (prev.currentIndex === index - 1) newIndex = index;
          return { ...prev, queue: newQueue, currentIndex: newIndex };
        }),
      onMoveDown: (index: number) =>
        setter((prev) => {
          if (index === prev.queue.length - 1) return prev;
          const newQueue = [...prev.queue];
          [newQueue[index], newQueue[index + 1]] = [
            newQueue[index + 1],
            newQueue[index],
          ];
          let newIndex = prev.currentIndex;
          if (prev.currentIndex === index) newIndex = index + 1;
          else if (prev.currentIndex === index + 1) newIndex = index;
          return { ...prev, queue: newQueue, currentIndex: newIndex };
        }),
    };
  }

  const queueHandlersA = makeQueueHandlers(setDeckA);
  const queueHandlersB = makeQueueHandlers(setDeckB);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-6 sm:px-6">
      {/* 상단: 덱 영역 (플레이어 + 볼륨) + 크로스페이더 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Deck A */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <DjDeck
            deckId="A"
            queue={deckA.queue}
            currentIndex={deckA.currentIndex}
            volume={calcEffectiveVolume(deckA.volume, crossfader, "A")}
            localVolume={deckA.volume}
            isProjecting={projectDeck === "A"}
            onVolumeChange={handleDeckAVolumeChange}
            onAddTrack={handleAddTrackA}
            onCurrentIndexChange={handleDeckAIndexChange}
            onTitleUpdate={handleDeckATitleUpdate}
          />
        </div>

        {/* Deck B */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <DjDeck
            deckId="B"
            queue={deckB.queue}
            currentIndex={deckB.currentIndex}
            volume={calcEffectiveVolume(deckB.volume, crossfader, "B")}
            localVolume={deckB.volume}
            isProjecting={projectDeck === "B"}
            onVolumeChange={handleDeckBVolumeChange}
            onAddTrack={handleAddTrackB}
            onCurrentIndexChange={handleDeckBIndexChange}
            onTitleUpdate={handleDeckBTitleUpdate}
          />
        </div>
      </div>

      {/* 크로스페이더 — 절반 너비, 중앙 정렬 */}
      <div className="mx-auto w-full max-w-sm">
        <Crossfader value={crossfader} onChange={setCrossfader} />
      </div>

      {/* 프로젝션 컨트롤 */}
      <div className="mx-auto flex items-center gap-2">
        <button
          onClick={openProjection}
          className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/10"
        >
          외부 출력 창 열기
        </button>
        <div className="flex rounded-lg border border-foreground/20 overflow-hidden text-xs">
          {(["A", "B"] as const).map((id) => (
            <button
              key={id}
              onClick={() => toggleProjectDeck(id)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                projectDeck === id
                  ? "bg-foreground text-background"
                  : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              }`}
            >
              Deck {id}
            </button>
          ))}
        </div>
        {projectDeck && (
          <span className="text-[10px] text-green-500">
            Deck {projectDeck} 출력 중
          </span>
        )}
      </div>

      {/* 하단: 큐 영역 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <h3 className="mb-2 text-xs font-bold tracking-wider text-foreground/50">
            QUEUE A
          </h3>
          <Queue
            tracks={deckA.queue}
            currentIndex={deckA.currentIndex}
            {...queueHandlersA}
          />
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <h3 className="mb-2 text-xs font-bold tracking-wider text-foreground/50">
            QUEUE B
          </h3>
          <Queue
            tracks={deckB.queue}
            currentIndex={deckB.currentIndex}
            {...queueHandlersB}
          />
        </div>
      </div>
    </div>
  );
}
