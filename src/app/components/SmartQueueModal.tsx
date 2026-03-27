"use client";

import { useState } from "react";
import { parseYouTubeUrl } from "../lib/parseUrl";
import { fetchVideoMetadata, fetchPlaylistTracks } from "../lib/youtubeData";
import type { Track } from "../lib/types";

interface SmartQueueModalProps {
  queueALength: number;
  queueBLength: number;
  onAddTracksA: (tracks: Track[]) => void;
  onAddTracksB: (tracks: Track[]) => void;
  onClose: () => void;
}

export default function SmartQueueModal({
  queueALength,
  queueBLength,
  onAddTracksA,
  onAddTracksB,
  onClose,
}: SmartQueueModalProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = parseYouTubeUrl(url.trim());

    // 재생목록 URL
    if (parsed.playlistId) {
      setLoading(true);
      setStatus("재생목록 로드 중...");
      try {
        const tracks = await fetchPlaylistTracks(parsed.playlistId);
        if (tracks.length === 0) {
          setError("재생목록에 재생 가능한 영상이 없습니다.");
          return;
        }

        // A/B 교대 분배
        const tracksA: Track[] = [];
        const tracksB: Track[] = [];
        tracks.forEach((track, i) => {
          if (i % 2 === 0) tracksA.push(track);
          else tracksB.push(track);
        });

        onAddTracksA(tracksA);
        onAddTracksB(tracksB);
        setStatus(`${tracks.length}곡 분배 완료 (A: ${tracksA.length}, B: ${tracksB.length})`);
        setTimeout(onClose, 1000);
      } catch {
        setError("재생목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // 단일 곡 URL → 짧은 큐에 추가
    if (parsed.videoId) {
      setLoading(true);
      setStatus("영상 정보 로드 중...");
      try {
        const track = await fetchVideoMetadata(parsed.videoId);
        if (queueALength <= queueBLength) {
          onAddTracksA([track]);
          setStatus(`Deck A 큐에 추가됨`);
        } else {
          onAddTracksB([track]);
          setStatus(`Deck B 큐에 추가됨`);
        }
        setTimeout(onClose, 800);
      } catch {
        // 폴백
        const track: Track = { videoId: parsed.videoId, title: "Video" };
        if (queueALength <= queueBLength) {
          onAddTracksA([track]);
        } else {
          onAddTracksB([track]);
        }
        onClose();
      } finally {
        setLoading(false);
      }
      return;
    }

    setError("유효한 YouTube URL 또는 재생목록 URL을 입력해주세요.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !loading) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-foreground/20 bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wider text-foreground/70">
            SMART QUEUE-IN
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-foreground/40 hover:text-foreground disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-foreground/50">
          재생목록 URL → A/B 큐에 교대 분배 | 단일 곡 → 짧은 큐에 자동 추가
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="YouTube URL 또는 재생목록 URL..."
            disabled={loading}
            autoFocus
            className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-foreground/40 transition-colors disabled:opacity-50"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-foreground/40">
              현재 큐: A({queueALength}곡) / B({queueBLength}곡)
            </span>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {loading ? "로드 중..." : "큐-인"}
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {status && !error && (
            <p className="text-xs text-green-500">{status}</p>
          )}
        </form>
      </div>
    </div>
  );
}
