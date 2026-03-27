/** 큐에 담기는 트랙 */
export interface Track {
  videoId: string;
  title: string; // 초기엔 'Video', 재생 시 실제 제목으로 갱신
}

/** 덱 식별자 */
export type DeckId = "A" | "B";
