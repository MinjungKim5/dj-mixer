"use client";

import { useState } from "react";
import { parseYouTubeUrl } from "../lib/parseUrl";
import { fetchVideoMetadata } from "../lib/youtubeData";
import type { Track } from "../lib/types";

interface TrackInputProps {
  onAddTrack: (tracks: Track[]) => void;
}

export default function TrackInput({ onAddTrack }: TrackInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = parseYouTubeUrl(url.trim());

    if (parsed.videoId) {
      setLoading(true);
      try {
        const track = await fetchVideoMetadata(parsed.videoId);
        onAddTrack([track]);
      } catch {
        // API 실패 시 폴백
        onAddTrack([{ videoId: parsed.videoId, title: "Video" }]);
      } finally {
        setLoading(false);
      }
      setUrl("");
      return;
    }

    if (parsed.playlistId) {
      setError("재생목록은 [+] 스마트 큐-인 버튼을 이용해주세요.");
      return;
    }

    setError("유효한 YouTube URL을 입력해주세요.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="YouTube URL 입력..."
        disabled={loading}
        className="flex-1 min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-foreground/40 transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {loading ? "..." : "추가"}
      </button>
      {error && (
        <p className="w-full text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
