"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeAPI } from "../lib/youtube";
import type { YTPlayer, YTPlayerEvent } from "../lib/youtube";
import { PROJECTION_CHANNEL } from "../lib/projection";
import type { ProjectionMessage } from "../lib/projection";

export default function ProjectionPage() {
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const pendingRef = useRef<ProjectionMessage[]>([]);

  // YouTube 플레이어 초기화
  useEffect(() => {
    loadYouTubeAPI().then(() => {
      if (!window.YT) return;
      playerRef.current = new window.YT.Player("projection-player", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
        },
        events: {
          onReady: () => {
            setReady(true);
            // 준비 전에 쌓인 메시지 처리
            pendingRef.current.forEach((msg) => handleMessage(msg));
            pendingRef.current = [];
          },
          onStateChange: (_event: YTPlayerEvent) => {},
        },
      });
    });

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  function handleMessage(msg: ProjectionMessage) {
    const player = playerRef.current;
    if (!player) {
      pendingRef.current.push(msg);
      return;
    }
    switch (msg.type) {
      case "load":
        player.loadVideoById(msg.videoId);
        break;
      case "play":
        player.playVideo();
        break;
      case "pause":
        player.pauseVideo();
        break;
      case "stop":
        player.stopVideo();
        break;
    }
  }

  // BroadcastChannel 수신
  useEffect(() => {
    const ch = new BroadcastChannel(PROJECTION_CHANNEL);
    ch.onmessage = (e: MessageEvent<ProjectionMessage>) => {
      handleMessage(e.data);
    };
    return () => ch.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <div id="projection-player" className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
          프로젝션 대기 중...
        </div>
      )}
    </div>
  );
}
