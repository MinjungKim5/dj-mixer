/**
 * YouTube IFrame API 타입 정의 및 로드 유틸리티
 */

// YouTube Player 상태 상수
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

// YouTube Player 이벤트 타입
export interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}

// YouTube Player 인스턴스 타입
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string; title: string };
  destroy(): void;
}

// YouTube Player 생성자 옵션
export interface YTPlayerOptions {
  height?: string | number;
  width?: string | number;
  videoId?: string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    fs?: 0 | 1;
  };
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: YTPlayerEvent) => void;
    onError?: (event: YTPlayerEvent) => void;
  };
}

// window.YT 글로벌 타입 확장
declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
      PlayerState: typeof YT_STATE;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// IFrame API 스크립트 로드 (한 번만 실행)
let apiLoadPromise: Promise<void> | null = null;

export function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve) => {
    // 이미 로드된 경우
    if (window.YT?.Player) {
      resolve();
      return;
    }

    // 콜백 등록
    window.onYouTubeIframeAPIReady = () => resolve();

    // 스크립트 삽입
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}
