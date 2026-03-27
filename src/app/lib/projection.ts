/**
 * 메인 창 ↔ 프로젝션 창 간 통신을 위한 BroadcastChannel 유틸
 */

export const PROJECTION_CHANNEL = "dj-mixer-projection";

export type ProjectionMessage =
  | { type: "load"; videoId: string }
  | { type: "play" }
  | { type: "pause" }
  | { type: "stop" };

export function sendProjection(msg: ProjectionMessage) {
  const ch = new BroadcastChannel(PROJECTION_CHANNEL);
  ch.postMessage(msg);
  ch.close();
}
