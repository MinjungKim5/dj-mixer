"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useId,
} from "react";
import { loadYouTubeAPI, YT_STATE } from "../lib/youtube";
import type { YTPlayer, YTPlayerEvent } from "../lib/youtube";

export interface YouTubePlayerHandle {
  play(): void;
  pause(): void;
  loadVideo(videoId: string): void;
  cueVideo(videoId: string): void;
  setVolume(volume: number): void;
  getVideoData(): { video_id: string; title: string } | null;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
}

interface YouTubePlayerProps {
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onEnded?: () => void;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ onReady, onStateChange, onEnded }, ref) {
    const playerRef = useRef<YTPlayer | null>(null);
    const containerId = useId().replace(/:/g, "_"); // 콜론 제거 (DOM id용)
    const divId = `yt-player-${containerId}`;

    // 콜백을 ref로 관리 (리렌더 시 최신값 유지)
    const callbacksRef = useRef({ onReady, onStateChange, onEnded });
    callbacksRef.current = { onReady, onStateChange, onEnded };

    useImperativeHandle(ref, () => ({
      play() {
        playerRef.current?.playVideo();
      },
      pause() {
        playerRef.current?.pauseVideo();
      },
      loadVideo(videoId: string) {
        playerRef.current?.loadVideoById(videoId);
      },
      cueVideo(videoId: string) {
        playerRef.current?.cueVideoById(videoId);
      },
      setVolume(volume: number) {
        playerRef.current?.setVolume(volume);
      },
      getVideoData() {
        return playerRef.current?.getVideoData() ?? null;
      },
      getCurrentTime() {
        return playerRef.current?.getCurrentTime() ?? 0;
      },
      getDuration() {
        return playerRef.current?.getDuration() ?? 0;
      },
      seekTo(seconds: number) {
        playerRef.current?.seekTo(seconds, true);
      },
      setPlaybackRate(rate: number) {
        playerRef.current?.setPlaybackRate(rate);
      },
      getPlaybackRate() {
        return playerRef.current?.getPlaybackRate() ?? 1;
      },
    }));

    useEffect(() => {
      let destroyed = false;

      loadYouTubeAPI().then(() => {
        if (destroyed || !window.YT) return;

        playerRef.current = new window.YT.Player(divId, {
          height: "100%",
          width: "100%",
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0,
          },
          events: {
            onReady: () => callbacksRef.current.onReady?.(),
            onStateChange: (event: YTPlayerEvent) => {
              callbacksRef.current.onStateChange?.(event.data);
              if (event.data === YT_STATE.ENDED) {
                callbacksRef.current.onEnded?.();
              }
            },
          },
        });
      });

      return () => {
        destroyed = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [divId]);

    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <div id={divId} />
      </div>
    );
  }
);

export default YouTubePlayer;
