/**
 * YouTube URL에서 videoId 또는 playlistId를 추출하는 유틸리티
 *
 * 지원 형식:
 *   youtube.com/watch?v={videoId}
 *   youtube.com/playlist?list={playlistId}
 *   youtube.com/watch?v={videoId}&list={playlistId}
 *   youtu.be/{videoId}
 */

export interface ParsedUrl {
  videoId: string | null;
  playlistId: string | null;
}

export function parseYouTubeUrl(url: string): ParsedUrl {
  const result: ParsedUrl = { videoId: null, playlistId: null };

  try {
    // youtu.be 단축 URL 처리
    if (url.includes("youtu.be/")) {
      const urlObj = new URL(url);
      result.videoId = urlObj.pathname.slice(1) || null;
      result.playlistId = urlObj.searchParams.get("list");
      return result;
    }

    // youtube.com URL 처리
    const urlObj = new URL(url);
    if (
      !urlObj.hostname.includes("youtube.com") &&
      !urlObj.hostname.includes("youtu.be")
    ) {
      return result;
    }

    result.videoId = urlObj.searchParams.get("v");
    result.playlistId = urlObj.searchParams.get("list");
  } catch {
    // 유효하지 않은 URL
  }

  return result;
}
