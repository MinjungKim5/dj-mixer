"use client";

import { useState } from "react";
import { parseYouTubeUrl } from "../lib/parseUrl";
import type { Track } from "../lib/types";

interface TrackInputProps {
  onAddTrack: (tracks: Track[]) => void;
}

export default function TrackInput({ onAddTrack }: TrackInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = parseYouTubeUrl(url.trim());

    if (parsed.videoId) {
      onAddTrack([{ videoId: parsed.videoId, title: "Video" }]);
      setUrl("");
      return;
    }

    if (parsed.playlistId) {
      setError("재생목록 지원은 추후 추가 예정입니다.");
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
        className="flex-1 min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-foreground/40 transition-colors"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
      >
        추가
      </button>
      {error && (
        <p className="w-full text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
