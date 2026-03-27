"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import YouTubePlayer from "./YouTubePlayer";
import TrackInput from "./TrackInput";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
import type { DeckId, Track } from "../lib/types";
import { sendProjection } from "../lib/projection";

interface DjDeckProps {
  deckId: DeckId;
  queue: Track[];
  currentIndex: number;
  volume: number; // 0~100 (크로스페이더 반영된 최종 볼륨)
  localVolume: number; // 개별 볼륨 (UI 표시용)
  isProjecting: boolean; // 이 덱이 현재 프로젝션 출력 대상인지
  onVolumeChange: (volume: number) => void;
  onAddTrack: (tracks: Track[]) => void;
  onCurrentIndexChange: (index: number) => void;
  onTitleUpdate: (index: number, title: string) => void;
}

export default function DjDeck({
  deckId,
  queue,
  currentIndex,
  volume,
  localVolume,
  isProjecting,
  onVolumeChange,
  onAddTrack,
  onCurrentIndexChange,
  onTitleUpdate,
}: DjDeckProps) {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  // 볼륨 변경 시 플레이어에 적용
  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  // 재생 / 일시정지
  function togglePlay() {
    if (!playerRef.current || queue.length === 0) return;

    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
      if (isProjecting) sendProjection({ type: "pause" });
    } else {
      if (currentIndex >= 0 && queue[currentIndex]) {
        playerRef.current.loadVideo(queue[currentIndex].videoId);
        if (isProjecting)
          sendProjection({ type: "load", videoId: queue[currentIndex].videoId });
      }
      playerRef.current.play();
      setIsPlaying(true);
      if (isProjecting) sendProjection({ type: "play" });
    }
  }

  // 곡 끝나면 다음 곡으로 자동 전환
  const handleEnded = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      onCurrentIndexChange(nextIndex);
      playerRef.current?.loadVideo(queue[nextIndex].videoId);
      setIsPlaying(true);
      if (isProjecting)
        sendProjection({ type: "load", videoId: queue[nextIndex].videoId });
    } else {
      setIsPlaying(false);
      if (isProjecting) sendProjection({ type: "stop" });
    }
  }, [currentIndex, queue, onCurrentIndexChange, isProjecting]);

  // 플레이어 상태 변경 시 제목 갱신
  const handleStateChange = useCallback(
    (state: number) => {
      if (state === 1) {
        setIsPlaying(true);
        const data = playerRef.current?.getVideoData();
        if (data?.title && currentIndex >= 0) {
          onTitleUpdate(currentIndex, data.title);
        }
      } else if (state === 2) {
        setIsPlaying(false);
      }
    },
    [currentIndex, onTitleUpdate]
  );

  // 큐 조작 함수들을 외부에서 사용할 수 있도록 export하지 않고,
  // page.tsx에서 Queue에 전달할 핸들러는 page.tsx에서 구성
  // → 여기서는 큐에서 곡 선택 시 플레이어 로드만 담당
  // 이를 위해 onCurrentIndexChange가 호출되면 자동 로드하는 effect 사용
  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (
      currentIndex !== prevIndexRef.current &&
      currentIndex >= 0 &&
      queue[currentIndex]
    ) {
      playerRef.current?.loadVideo(queue[currentIndex].videoId);
      setIsPlaying(true);
      if (isProjecting)
        sendProjection({ type: "load", videoId: queue[currentIndex].videoId });
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, queue, isProjecting]);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const isA = deckId === "A";

  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-foreground/70">
          DECK {deckId}
        </h2>
        {playerReady && (
          <span className="text-[10px] text-green-500">READY</span>
        )}
      </div>

      {/* URL 입력 */}
      <TrackInput onAddTrack={onAddTrack} />

      {/* 플레이어 + 세로 볼륨 */}
      <div className={`flex gap-2 ${isA ? "flex-row" : "flex-row-reverse"}`}>
        {/* YouTube 플레이어 */}
        <div className="flex-1 min-w-0">
          <YouTubePlayer
            ref={playerRef}
            onReady={() => setPlayerReady(true)}
            onStateChange={handleStateChange}
            onEnded={handleEnded}
          />
        </div>

        {/* 세로 볼륨 슬라이더 + 눈금 */}
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] font-mono text-foreground/50">
            {localVolume}
          </span>
          <div className="relative flex items-center" style={{ height: 150 }}>
            {/* 눈금 */}
            <div
              className={`absolute flex flex-col justify-between ${
                isA ? "-right-3" : "-left-3"
              }`}
              style={{ height: 150 }}
            >
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className={`bg-foreground/20 ${
                    i % 5 === 0 ? "w-2.5 h-px" : "w-1.5 h-px"
                  }`}
                />
              ))}
            </div>
            {/* 슬라이더 */}
            <input
              type="range"
              min={0}
              max={100}
              value={localVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="dj-slider-v"
              style={{
                writingMode: "vertical-lr",
                direction: "rtl",
                height: 150,
                width: 20,
              }}
            />
          </div>
          <span className="text-[10px] text-foreground/40">Vol</span>
        </div>
      </div>

      {/* 재생 컨트롤 */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={queue.length === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-lg transition-colors hover:bg-foreground/20 disabled:opacity-30"
          aria-label={isPlaying ? "일시정지" : "재생"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">
            {currentTrack?.title || "재생 중인 곡 없음"}
          </p>
        </div>
      </div>
    </div>
  );
}
