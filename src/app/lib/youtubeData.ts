import type { Track } from "./types";

const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_PLAYLIST_ITEMS = 200;

/** 단일 영상의 메타데이터(제목, 썸네일)를 가져온다 */
export async function fetchVideoMetadata(videoId: string): Promise<Track> {
  const url = `${BASE}/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error("Video not found");

  return {
    videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url,
  };
}

/** 재생목록의 모든 영상을 가져온다 (페이지네이션 포함, 최대 200곡) */
export async function fetchPlaylistTracks(
  playlistId: string
): Promise<Track[]> {
  const tracks: Track[] = [];
  let pageToken: string | undefined;

  while (tracks.length < MAX_PLAYLIST_ITEMS) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      key: API_KEY!,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${BASE}/playlistItems?${params}`);
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

    const data = await res.json();

    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      // 비공개/삭제된 영상 필터링
      if (
        snippet.title === "Private video" ||
        snippet.title === "Deleted video"
      ) {
        continue;
      }

      tracks.push({
        videoId: snippet.resourceId.videoId,
        title: snippet.title,
        thumbnail: snippet.thumbnails?.default?.url,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return tracks;
}
