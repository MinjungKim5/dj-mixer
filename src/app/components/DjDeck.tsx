"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import YouTubePlayer from "./YouTubePlayer";
import type { YouTubePlayerHandle } from "./YouTubePlayer";
import type { DeckId, Track } from "../lib/types";
import { sendProjection } from "../lib/projection";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface DjDeckHandle {
  play(): void;
  pause(): void;
  togglePlay(): void;
  /** 특정 곡을 로드하고 재생 */
  loadAndPlay(videoId: string): void;
  /** 다음 곡을 로드 후 즉시 정지 (스탠바이) */
  cueNext(): void;
}

interface DjDeckProps {
  deckId: DeckId;
  queue: Track[];
  currentIndex: number;
  volume: number; // 0~100 (크로스페이더 반영된 최종 볼륨)
  localVolume: number; // 개별 볼륨 (UI 표시용)
  playbackRate: number; // 배속 (0.25 ~ 2)
  isProjecting: boolean; // 이 덱이 현재 프로젝션 출력 대상인지
  autoMode?: boolean; // 오토모드 활성 여부
  onVolumeChange: (volume: number) => void;
  onCurrentIndexChange: (index: number) => void;
  onTitleUpdate: (index: number, title: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const DjDeck = forwardRef<DjDeckHandle, DjDeckProps>(function DjDeck({
  deckId,
  queue,
  currentIndex,
  volume,
  localVolume,
  playbackRate,
  isProjecting,
  autoMode,
  onVolumeChange,
  onCurrentIndexChange,
  onTitleUpdate,
  onTimeUpdate,
}, ref) {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  // 외부에서 덱을 제어할 수 있는 핸들
  useImperativeHandle(ref, () => ({
    play() {
      if (!playerRef.current || queue.length === 0) return;
      if (currentIndex >= 0 && queue[currentIndex]) {
        playerRef.current.loadVideo(queue[currentIndex].videoId);
      }
      playerRef.current.play();
      setIsPlaying(true);
    },
    loadAndPlay(videoId: string) {
      if (!playerRef.current) return;
      playerRef.current.loadVideo(videoId);
      playerRef.current.play();
      setIsPlaying(true);
    },
    pause() {
      playerRef.current?.pause();
      setIsPlaying(false);
    },
    togglePlay() {
      if (!playerRef.current || queue.length === 0) return;
      if (isPlaying) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        if (currentIndex >= 0 && queue[currentIndex]) {
          playerRef.current.loadVideo(queue[currentIndex].videoId);
        }
        playerRef.current.play();
        setIsPlaying(true);
      }
    },
    cueNext() {
      const nextIndex = currentIndex + 1;
      if (nextIndex < queue.length) {
        onCurrentIndexChange(nextIndex);
        playerRef.current?.cueVideo(queue[nextIndex].videoId);
        setIsPlaying(false);
      }
    },
  }));

  // 재생 시간 폴링 (250ms 간격)
  useEffect(() => {
    if (isPlaying) {
      timeIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const ct = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          setCurrentTime(ct);
          setDuration(dur);
          onTimeUpdateRef.current?.(ct, dur);
        }
      }, 250);
    } else {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
    }
    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
    };
  }, [isPlaying]);

  // 타임라인 시크
  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const time = Number(e.target.value);
    playerRef.current?.seekTo(time);
    setCurrentTime(time);
  }

  // 볼륨 변경 시 플레이어에 적용
  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  // 배속 변경 시 플레이어에 적용
  useEffect(() => {
    playerRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

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
    if (autoMode) {
      // 오토모드: 인덱스만 진행하고 정지 (다음 preroll 시그널에서 play)
      if (nextIndex < queue.length) {
        onCurrentIndexChange(nextIndex);
      }
      setIsPlaying(false);
      return;
    }
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
  }, [currentIndex, queue, onCurrentIndexChange, isProjecting, autoMode]);

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

  function toggleFullscreen() {
    const el = playerContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const isA = deckId === "A";

  return (
    <div className={`relative flex flex-col gap-3 rounded-lg transition-all duration-700 ${
      isPlaying ? "deck-wave" : ""
    }`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-foreground/70">
          DECK {deckId}
        </h2>
        {playerReady && (
          <span className={`text-[10px] ${isPlaying ? "text-blue-400" : "text-green-500"}`}>
            {isPlaying ? "ON AIR" : "READY"}
          </span>
        )}
      </div>

      {/* 플레이어 + 세로 볼륨 */}
      <div className={`flex gap-2 ${isA ? "flex-row" : "flex-row-reverse"}`}>
        {/* YouTube 플레이어 */}
        <div ref={playerContainerRef} className="flex-1 min-w-0">
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-lg transition-colors hover:bg-foreground/20 disabled:opacity-30"
          aria-label={isPlaying ? "일시정지" : "재생"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">
            {currentTrack?.title || "재생 중인 곡 없음"}
          </p>
          {/* 타임라인 바 + 전체화면 */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-foreground/50 tabular-nums">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              value={currentTime}
              onChange={handleSeek}
              className="dj-playbar flex-1 min-w-0"
            />
            <span className="text-[10px] font-mono text-foreground/50 tabular-nums">
              {formatTime(duration)}
            </span>
            <button
              onClick={toggleFullscreen}
              className="shrink-0 rounded p-0.5 text-foreground/40 hover:text-foreground/70 transition-colors"
              aria-label="전체화면"
              title="전체화면"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DjDeck;
