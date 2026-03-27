"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DjDeck from "./components/DjDeck";
import type { DjDeckHandle } from "./components/DjDeck";
import Queue from "./components/Queue";
import Crossfader from "./components/Crossfader";
import CrossfaderCommand from "./components/CrossfaderCommand";
import type { DeckId, Track } from "./lib/types";
import { sendProjection } from "./lib/projection";
import { useAutoMode, AUTO_CONFIG } from "./lib/automode";

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
  const [rateA, setRateA] = useState(1);
  const [rateB, setRateB] = useState(1);
  const [projectDeck, setProjectDeck] = useState<DeckId | null>(null);
  const projWindowRef = useRef<Window | null>(null);

  // 오토모드
  const { enabled: autoMode } = useAutoMode();
  const deckARef = useRef<DjDeckHandle>(null);
  const deckBRef = useRef<DjDeckHandle>(null);
  const activeDeckRef = useRef<DeckId>("A");
  const autoPhaseRef = useRef<"idle" | "preroll" | "fading">("idle");
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfaderRef = useRef(crossfader);
  crossfaderRef.current = crossfader;

  // 오토모드 비활성화 시 정리
  useEffect(() => {
    if (!autoMode) {
      autoPhaseRef.current = "idle";
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    }
  }, [autoMode]);

  // 오토모드: 크로스페이드 애니메이션 실행
  function startAutoFade(target: number, durationMs: number, onDone?: () => void) {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }
    const steps = Math.max(1, Math.round(durationMs / 16));
    const intervalMs = durationMs / steps;
    let step = 0;
    // 현재 crossfader 값을 캡처
    const startValue = crossfaderRef.current;

    fadeIntervalRef.current = setInterval(() => {
      step++;
      if (step >= steps) {
        setCrossfader(target);
        clearInterval(fadeIntervalRef.current!);
        fadeIntervalRef.current = null;
        onDone?.();
      } else {
        const progress = step / steps;
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        const delta = target - startValue;
        setCrossfader(
          Math.round((startValue + delta * eased) * 1000) / 1000
        );
      }
    }, intervalMs);
  }

  // 오토모드: 시간 업데이트 핸들러
  function handleAutoTimeUpdate(deckId: DeckId, currentTime: number, duration: number) {
    if (!autoMode || duration === 0) return;
    if (deckId !== activeDeckRef.current) return;

    const remaining = duration - currentTime;
    const { prerollSec, fadeStartSec, fadeDurationSec } = AUTO_CONFIG;

    // 프리롤: 다음 덱 재생 시작
    if (remaining <= prerollSec && autoPhaseRef.current === "idle") {
      autoPhaseRef.current = "preroll";
      const nextDeckRef = activeDeckRef.current === "A" ? deckBRef : deckARef;
      nextDeckRef.current?.play();
    }

    // 크로스페이드 시작
    if (remaining <= fadeStartSec && autoPhaseRef.current === "preroll") {
      autoPhaseRef.current = "fading";
      const nextDeck: DeckId = activeDeckRef.current === "A" ? "B" : "A";
      const fadeTarget = nextDeck === "B" ? 1 : -1;

      startAutoFade(fadeTarget, fadeDurationSec * 1000, () => {
        // 크로스페이드 완료: activeDeck 전환
        activeDeckRef.current = nextDeck;
        autoPhaseRef.current = "idle";

        // 프로젝션 전환
        setProjectDeck(nextDeck);
      });
    }
  }

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
    setter: React.Dispatch<React.SetStateAction<DeckState>>,
    deckRef: React.RefObject<DjDeckHandle | null>,
    getDeck: () => DeckState
  ) {
    return {
      onSelect: (index: number) => {
        setter((prev) => ({ ...prev, currentIndex: index }));
        const deck = getDeck();
        if (deck.queue[index]) {
          deckRef.current?.loadAndPlay(deck.queue[index].videoId);
        }
      },
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

  const queueHandlersA = makeQueueHandlers(setDeckA, deckARef, () => deckA);
  const queueHandlersB = makeQueueHandlers(setDeckB, deckBRef, () => deckB);

  return (
    <div
      className={`flex flex-1 flex-col gap-4 px-4 pb-6 sm:px-6 transition-shadow duration-500 ${
        autoMode
          ? "rounded-xl shadow-[inset_0_0_60px_rgba(34,197,94,0.2),inset_0_0_0_1px_rgba(34,197,94,0.4)]"
          : ""
      }`}
    >
      {/* 상단: 덱 영역 (플레이어 + 볼륨) + 크로스페이더 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Deck A */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <DjDeck
            ref={deckARef}
            deckId="A"
            queue={deckA.queue}
            currentIndex={deckA.currentIndex}
            volume={calcEffectiveVolume(deckA.volume, crossfader, "A")}
            localVolume={deckA.volume}
            playbackRate={rateA}
            isProjecting={projectDeck === "A"}
            autoMode={autoMode}
            onVolumeChange={handleDeckAVolumeChange}
            onAddTrack={handleAddTrackA}
            onCurrentIndexChange={handleDeckAIndexChange}
            onTitleUpdate={handleDeckATitleUpdate}
            onTimeUpdate={(ct, dur) => handleAutoTimeUpdate("A", ct, dur)}
          />
        </div>

        {/* Deck B */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <DjDeck
            ref={deckBRef}
            deckId="B"
            queue={deckB.queue}
            currentIndex={deckB.currentIndex}
            volume={calcEffectiveVolume(deckB.volume, crossfader, "B")}
            localVolume={deckB.volume}
            playbackRate={rateB}
            isProjecting={projectDeck === "B"}
            autoMode={autoMode}
            onVolumeChange={handleDeckBVolumeChange}
            onAddTrack={handleAddTrackB}
            onCurrentIndexChange={handleDeckBIndexChange}
            onTitleUpdate={handleDeckBTitleUpdate}
            onTimeUpdate={(ct, dur) => handleAutoTimeUpdate("B", ct, dur)}
          />
        </div>
      </div>

      {/* 배속 A + 크로스페이더 + 배속 B — 3등분 그리드 */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* 배속 A — 왼쪽 칸 중앙 정렬 */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold tracking-wider text-foreground/50">
              SPEED A
            </span>
            <div className="flex items-center gap-1.5 w-36">
              <input
                type="range"
                min={25}
                max={200}
                value={rateA * 100}
                onChange={(e) => setRateA(Number(e.target.value) / 100)}
                className="dj-timeline flex-1"
              />
              <span className="text-[10px] font-mono text-foreground/60 tabular-nums">
                {rateA.toFixed(2)}x
              </span>
            </div>
            <button
              onClick={() => setRateA(1)}
              className="text-[9px] text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              reset
            </button>
          </div>
        </div>

        {/* 크로스페이더 — 중앙 고정 */}
        <div className="w-64">
          <Crossfader value={crossfader} onChange={setCrossfader} />
        </div>

        {/* 배속 B — 오른쪽 칸 중앙 정렬 */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold tracking-wider text-foreground/50">
              SPEED B
            </span>
            <div className="flex items-center gap-1.5 w-36">
              <input
                type="range"
                min={25}
                max={200}
                value={rateB * 100}
                onChange={(e) => setRateB(Number(e.target.value) / 100)}
                className="dj-timeline flex-1"
              />
              <span className="text-[10px] font-mono text-foreground/60 tabular-nums">
                {rateB.toFixed(2)}x
              </span>
            </div>
            <button
              onClick={() => setRateB(1)}
              className="text-[9px] text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              reset
            </button>
          </div>
        </div>
      </div>

      {/* 크로스페이더 명령어 */}
      <div className="mx-auto">
        <CrossfaderCommand crossfader={crossfader} onChange={setCrossfader} />
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
