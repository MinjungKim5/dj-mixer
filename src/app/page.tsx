"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DjDeck from "./components/DjDeck";
import type { DjDeckHandle } from "./components/DjDeck";
import Queue from "./components/Queue";
import Crossfader from "./components/Crossfader";
import CrossfaderCommand from "./components/CrossfaderCommand";
import SmartQueueModal from "./components/SmartQueueModal";
import type { DeckId, Track } from "./lib/types";
import { sendProjection } from "./lib/projection";
import { useAutoMode, AUTO_CONFIG } from "./lib/automode";
import { parseYouTubeUrl } from "./lib/parseUrl";
import { fetchVideosMetadata, fetchPlaylistTracks } from "./lib/youtubeData";

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
  side: "A" | "B",
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
  const [showSmartQueue, setShowSmartQueue] = useState(false);
  const projWindowRef = useRef<Window | null>(null);

  const stateARef = useRef(deckA);
  stateARef.current = deckA;
  const stateBRef = useRef(deckB);
  stateBRef.current = deckB;

  const [syncPlaylist, setSyncPlaylist] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const [syncYTPlaylist, setSyncYTPlaylist] = useState("");
  const [isYTSyncing, setIsYTSyncing] = useState(false);

  // 스마트 동기화 로직 (구글 시트 & 유튜브 공통)
  const applySmartSync = useCallback((
    fetchedQueue: Track[],
    setter: React.Dispatch<React.SetStateAction<DeckState>>
  ) => {
    setter((prev) => {
      const historyLen = Math.max(0, prev.currentIndex + 1);
      const historyQueue = prev.queue.slice(0, historyLen);

      let matchIdx = -1;
      for (let i = historyQueue.length - 1; i >= 0; i--) {
        const hTrack = historyQueue[i];
        matchIdx = fetchedQueue.findIndex((t) => t.videoId === hTrack.videoId);
        if (matchIdx !== -1) break;
      }

      const upcomingQueue = matchIdx !== -1 ? fetchedQueue.slice(matchIdx + 1) : fetchedQueue;
      const newQueue = [...historyQueue, ...upcomingQueue];

      // 큐가 동일한지 대략적인 비교 후 상태변경 최소화
      const oldStr = JSON.stringify(prev.queue);
      const newStr = JSON.stringify(newQueue);
      const newIndex = (prev.currentIndex === -1 && newQueue.length > 0) ? 0 : prev.currentIndex;
      return { ...prev, queue: newQueue, currentIndex: newIndex };
    });
  }, []);

  // 오토모드
  const { enabled: autoMode } = useAutoMode();
  const deckARef = useRef<DjDeckHandle>(null);
  const deckBRef = useRef<DjDeckHandle>(null);
  const activeDeckRef = useRef<DeckId>("A");
  const autoPhaseRef = useRef<"idle" | "preroll" | "fading">("idle");
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfaderRef = useRef(crossfader);
  crossfaderRef.current = crossfader;

  // 키보드 단축키
  const rateARef = useRef(rateA);
  rateARef.current = rateA;
  const rateBRef = useRef(rateB);
  rateBRef.current = rateB;
  const showSmartQueueRef = useRef(showSmartQueue);
  showSmartQueueRef.current = showSmartQueue;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // input/textarea 포커스 중에는 무시
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const clamp = (v: number) =>
        Math.round(Math.max(0.25, Math.min(2, v)) * 100) / 100;

      switch (e.code) {
        case "KeyQ":
          e.preventDefault();
          setShowSmartQueue((prev) => !prev);
          break;
        case "KeyA":
          deckARef.current?.togglePlay();
          break;
        case "KeyB":
          deckBRef.current?.togglePlay();
          break;
        case "KeyU":
          setRateA(clamp(rateARef.current - 0.05));
          break;
        case "KeyI":
          setRateA(clamp(rateARef.current + 0.05));
          break;
        case "KeyO":
          setRateB(clamp(rateBRef.current - 0.05));
          break;
        case "KeyP":
          setRateB(clamp(rateBRef.current + 0.05));
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // 구글 시트 재생목록 자동 동기화
  useEffect(() => {
    let active = true;
    if (!isSyncing || !syncPlaylist) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    async function fetchPlaylist() {
      try {
        // Use a direct fetch since the target server now supports CORS.
        const targetUrl = `https://super-simple-sheet.space/json/${syncPlaylist}?t=${Date.now()}`;
        const res = await fetch(targetUrl, {
          cache: "no-store",
          headers: {
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
          }
        });
        if (!res.ok) throw new Error("Failed to fetch playlist");
        const data = await res.json();
        
        const fetchedA: Track[] = [];
        const fetchedB: Track[] = [];
        const fetchedQ: Track[] = [];

        if (Array.isArray(data)) {
          for (const r of data) {
            if (r.A) {
              const parsed = parseYouTubeUrl(r.A);
              if (parsed.videoId) {
                fetchedA.push({ videoId: parsed.videoId, title: r["A제목"] || "Video" });
              }
            }
            if (r.B) {
              const parsed = parseYouTubeUrl(r.B);
              if (parsed.videoId) {
                fetchedB.push({ videoId: parsed.videoId, title: r["B제목"] || "Video" });
              }
            }
            if (r.Q) {
              const parsed = parseYouTubeUrl(r.Q);
              if (parsed.videoId) {
                fetchedQ.push({ videoId: parsed.videoId, title: r["Q제목"] || "Video" });
              }
            }
          }
        }

        // Q열 트랙을 A와 B에 번갈아가며 분배 (Smart Queue)
        fetchedQ.forEach((track, i) => {
          if (i % 2 === 0) fetchedA.push(track);
          else fetchedB.push(track);
        });

        // 기존 큐에서 메타데이터 복원 및 누락된 ID 수집
        const missingIds = new Set<string>();
        const allFetched = [...fetchedA, ...fetchedB];
        allFetched.forEach(t => {
           const inA = stateARef.current.queue.find(x => x.videoId === t.videoId);
           const inB = stateBRef.current.queue.find(x => x.videoId === t.videoId);
           const existing = inA || inB;
           if (existing && existing.title !== "Video") {
              t.title = existing.title;
              t.thumbnail = existing.thumbnail;
           } else if (t.title === "Video" || !t.title) {
              missingIds.add(t.videoId);
           }
        });

        // 누락된 메타데이터 일괄 가져오기 기능 연동
        if (missingIds.size > 0) {
           try {
             const metaMap = await fetchVideosMetadata(Array.from(missingIds));
             allFetched.forEach(t => {
                if (metaMap.has(t.videoId)) {
                   t.title = metaMap.get(t.videoId)!.title;
                   t.thumbnail = metaMap.get(t.videoId)!.thumbnail;
                }
             });
           } catch(e) {
             console.error("Batch Meta Fetch Error:", e);
           }
        }

        if (active) {
          applySmartSync(fetchedA, setDeckA);
          applySmartSync(fetchedB, setDeckB);
        }

      } catch (err) {
        if (active) console.error("Sheet Sync Error:", err);
      } finally {
        if (active && isSyncing) {
          timeoutId = setTimeout(fetchPlaylist, 15000); // 15초 폴링
        }
      }
    }

    if (active) fetchPlaylist();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [isSyncing, syncPlaylist, applySmartSync]);

  // YouTube 재생목록 자동 동기화
  useEffect(() => {
    let active = true;
    if (!isYTSyncing || !syncYTPlaylist) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    async function fetchYTPlaylist() {
      try {
        const parsed = parseYouTubeUrl(syncYTPlaylist);
        if (!parsed.playlistId) throw new Error("Invalid Playlist URL");

        const tracks = await fetchPlaylistTracks(parsed.playlistId);
        
        if (tracks.length === 0) return;

        // A/B 교대 분배 (스마트 큐 인 규칙)
        const fetchedA: Track[] = [];
        const fetchedB: Track[] = [];
        tracks.forEach((track, i) => {
          if (i % 2 === 0) fetchedA.push(track);
          else fetchedB.push(track);
        });

        if (active) {
          applySmartSync(fetchedA, setDeckA);
          applySmartSync(fetchedB, setDeckB);
        }

      } catch (err) {
        if (active) console.error("YouTube Sync Error:", err);
      } finally {
        if (active && isYTSyncing) {
          timeoutId = setTimeout(fetchYTPlaylist, 30000); // 30초 폴링
        }
      }
    }

    if (active) fetchYTPlaylist();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [isYTSyncing, syncYTPlaylist, applySmartSync]);

  // 오토모드: 크로스페이드 애니메이션 실행
  function startAutoFade(
    target: number,
    durationMs: number,
    onDone?: () => void,
  ) {
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
        setCrossfader(Math.round((startValue + delta * eased) * 1000) / 1000);
      }
    }, intervalMs);
  }

  // 오토모드: 시간 업데이트 핸들러
  function handleAutoTimeUpdate(
    deckId: DeckId,
    currentTime: number,
    duration: number,
  ) {
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
      "popup",
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
    [],
  );
  const handleAddTrackB = useCallback(
    (tracks: Track[]) =>
      setDeckB((prev) => {
        const newQueue = [...prev.queue, ...tracks];
        const newIndex = prev.currentIndex === -1 ? 0 : prev.currentIndex;
        return { ...prev, queue: newQueue, currentIndex: newIndex };
      }),
    [],
  );

  // --- 덱 A 핸들러 ---
  const handleDeckAIndexChange = useCallback(
    (currentIndex: number) => setDeckA((prev) => ({ ...prev, currentIndex })),
    [],
  );
  const handleDeckAVolumeChange = useCallback(
    (volume: number) => setDeckA((prev) => ({ ...prev, volume })),
    [],
  );
  const handleDeckATitleUpdate = useCallback(
    (index: number, title: string) =>
      setDeckA((prev) => {
        const queue = [...prev.queue];
        if (queue[index]) queue[index] = { ...queue[index], title };
        return { ...prev, queue };
      }),
    [],
  );

  // --- 덱 B 핸들러 ---
  const handleDeckBIndexChange = useCallback(
    (currentIndex: number) => setDeckB((prev) => ({ ...prev, currentIndex })),
    [],
  );
  const handleDeckBVolumeChange = useCallback(
    (volume: number) => setDeckB((prev) => ({ ...prev, volume })),
    [],
  );
  const handleDeckBTitleUpdate = useCallback(
    (index: number, title: string) =>
      setDeckB((prev) => {
        const queue = [...prev.queue];
        if (queue[index]) queue[index] = { ...queue[index], title };
        return { ...prev, queue };
      }),
    [],
  );

  // --- 큐 조작 (공통 팩토리) ---
  function makeQueueHandlers(
    setter: React.Dispatch<React.SetStateAction<DeckState>>,
    deckRef: React.RefObject<DjDeckHandle | null>,
    getDeck: () => DeckState,
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
              newQueue.length > 0 ? Math.min(index, newQueue.length - 1) : -1;
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
      onReorder: (fromIndex: number, toIndex: number) =>
        setter((prev) => {
          const newQueue = [...prev.queue];
          const [moved] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, moved);
          let newIndex = prev.currentIndex;
          if (prev.currentIndex === fromIndex) {
            newIndex = toIndex;
          } else if (
            fromIndex < prev.currentIndex &&
            toIndex >= prev.currentIndex
          ) {
            newIndex = prev.currentIndex - 1;
          } else if (
            fromIndex > prev.currentIndex &&
            toIndex <= prev.currentIndex
          ) {
            newIndex = prev.currentIndex + 1;
          }
          return { ...prev, queue: newQueue, currentIndex: newIndex };
        }),
    };
  }

  const queueHandlersA = makeQueueHandlers(setDeckA, deckARef, () => deckA);
  const queueHandlersB = makeQueueHandlers(setDeckB, deckBRef, () => deckB);

  return (
    <div
      className={`flex flex-1 flex-col gap-4 px-4 pb-6 sm:px-6 transition-shadow duration-500 ${autoMode
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
              className={`px-3 py-1.5 font-medium transition-colors ${projectDeck === id
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

      {/* 큐 연동 및 스마트 큐-인 버튼 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-3">
          <div className="flex flex-1 max-w-sm items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/[0.03] p-1.5 focus-within:border-foreground/40 transition-colors">
            <input
              type="text"
              placeholder="YouTube 재생목록 (URL 또는 ID)"
              value={syncYTPlaylist}
              onChange={(e) => setSyncYTPlaylist(e.target.value)}
              disabled={isYTSyncing}
              className="flex-1 bg-transparent px-2 py-0.5 text-sm font-medium text-foreground placeholder-foreground/30 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setIsYTSyncing(!isYTSyncing)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold tracking-wide transition-colors ${
                isYTSyncing
                  ? "bg-red-500/90 text-white shadow-md shadow-red-500/20"
                  : "bg-foreground/10 text-foreground/60 hover:bg-foreground/20"
              }`}
            >
              {isYTSyncing ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                  </span>
                  YT SYNCING
                </>
              ) : (
                "YT SYNC"
              )}
            </button>
          </div>
          <div className="w-10" /> {/* 간격 맞춤용 */}
        </div>
        <div className="flex items-center justify-end gap-3">
          <div className="flex flex-1 max-w-sm items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/[0.03] p-1.5 focus-within:border-foreground/40 transition-colors">
            <input
              type="text"
              placeholder="시트 재생목록 (예: 플레이리스트260329)"
              value={syncPlaylist}
              onChange={(e) => setSyncPlaylist(e.target.value)}
              disabled={isSyncing}
              className="flex-1 bg-transparent px-2 py-0.5 text-sm font-medium text-foreground placeholder-foreground/30 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setIsSyncing(!isSyncing)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold tracking-wide transition-colors ${
                isSyncing
                  ? "bg-green-500/90 text-white shadow-md shadow-green-500/20"
                  : "bg-foreground/10 text-foreground/60 hover:bg-foreground/20"
              }`}
            >
              {isSyncing ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                  </span>
                  SYNCING
                </>
              ) : (
                "SYNC"
              )}
            </button>
          </div>
          <button
            onClick={() => setShowSmartQueue(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-foreground/20 bg-foreground text-xl font-light text-background transition-opacity hover:opacity-80 shadow-sm"
            title="스마트 큐-인 (수동 A/B 분배)"
          >
            +
          </button>
        </div>
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
            onAddTrack={handleAddTrackA}
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
            onAddTrack={handleAddTrackB}
            {...queueHandlersB}
          />
        </div>
      </div>

      {/* 스마트 큐-인 모달 */}
      {showSmartQueue && (
        <SmartQueueModal
          queueALength={deckA.queue.length}
          queueBLength={deckB.queue.length}
          onAddTracksA={handleAddTrackA}
          onAddTracksB={handleAddTrackB}
          onClose={() => setShowSmartQueue(false)}
        />
      )}
    </div>
  );
}
