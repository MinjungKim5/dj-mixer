# Phase 2 코어 기능 학습 노트

## 1. YouTube IFrame API 래퍼 패턴

### 왜 이렇게 만들었나?

YouTube IFrame API는 **전역 스크립트**로 동작합니다. `<script>` 태그를 삽입하면 `window.YT`에 API가 붙고, `window.onYouTubeIframeAPIReady` 콜백이 호출됩니다. React와 잘 맞지 않는 구조이므로 래퍼가 필요합니다.

### 핵심 포인트

```
[youtube.ts]  → API 타입 정의 + 스크립트 로드 (Promise)
[YouTubePlayer.tsx] → React 컴포넌트 래퍼 (forwardRef + useImperativeHandle)
```

**`loadYouTubeAPI()`** — 싱글톤 패턴으로 스크립트를 한 번만 로드합니다:
- `apiLoadPromise` 변수에 Promise를 캐싱
- 두 번째 호출부터는 같은 Promise를 반환
- 이미 로드 완료되었으면 즉시 resolve

**`forwardRef` + `useImperativeHandle`** — 부모 컴포넌트가 플레이어를 직접 제어할 수 있게 합니다:
- `forwardRef`로 ref를 받고
- `useImperativeHandle`로 `play()`, `pause()`, `loadVideo()` 등의 메서드를 노출
- 부모(DjDeck)에서 `playerRef.current.play()` 형태로 호출

**콜백을 ref로 관리하는 이유:**
```typescript
const callbacksRef = useRef({ onReady, onStateChange, onEnded });
callbacksRef.current = { onReady, onStateChange, onEnded };
```
YouTube Player는 `useEffect`에서 한 번만 생성됩니다. 콜백 prop이 바뀌어도 Player를 다시 만들면 안 되므로, ref에 최신 콜백을 저장하고 이벤트 발생 시 ref에서 꺼내 씁니다.

**`useId()`** — React 18+에서 SSR-safe한 고유 ID를 생성합니다. YouTube Player는 DOM element의 `id`를 요구하므로 이걸로 충돌 없이 두 개 플레이어를 만들 수 있습니다.

---

## 2. URL 파싱

`new URL(url)`로 파싱한 뒤 `searchParams.get()`으로 파라미터를 추출합니다. `try-catch`로 잘못된 URL을 처리합니다.

---

## 3. 상태 끌어올리기 (State Lifting)

### 왜 page.tsx에서 상태를 관리하나?

```
page.tsx (상태 소유)
├── TrackInput (큐에 곡 추가)
├── DjDeck A (자기 큐/볼륨 표시 & 제어)
├── DjDeck B (자기 큐/볼륨 표시 & 제어)
└── Crossfader (양쪽 볼륨에 영향)
```

**크로스페이더**가 양쪽 덱의 볼륨에 영향을 미치므로, 볼륨 계산을 한 곳에서 해야 합니다. 그래서 `page.tsx`가 전체 상태를 소유하고, 자식에게는 값 + 콜백을 내려줍니다.

### 크로스페이더 볼륨 공식

```
최종볼륨 = 개별볼륨 × 크로스페이더 비율

crossfader = -1 → A: 100%, B: 0%
crossfader =  0 → A: 100%, B: 100%  (중앙)
crossfader =  1 → A: 0%,   B: 100%
```

- A 쪽: crossfader가 양수(B 쪽)일 때만 비율 감소 → `ratio = 1 - crossfader`
- B 쪽: crossfader가 음수(A 쪽)일 때만 비율 감소 → `ratio = 1 + crossfader`

---

## 4. 큐 관리와 인덱스 보정

곡을 삭제하거나 순서를 변경할 때, `currentIndex`도 함께 보정해야 합니다:

- **삭제**: 현재 곡 앞의 곡이 삭제되면 index를 -1
- **이동**: 현재 곡이 위/아래로 이동하면 index를 따라서 변경
- **자동 전환**: `onEnded` 콜백에서 `currentIndex + 1`로 다음 곡 로드

---

## 5. 프로젝션 출력 (외부 모니터/프로젝터)

### 문제

웹 앱에서 외부 모니터를 직접 제어하는 표준 API는 제한적입니다 (Presentation API는 브라우저 지원이 부족). 하지만 DJ 앱에서는 프로젝터에 영상을 전체화면으로 띄우는 기능이 필수적입니다.

### 해결: 별도 창 + BroadcastChannel

```
┌─ 메인 창 (조작용) ──┐       BroadcastChannel        ┌─ 프로젝션 창 (출력용) ─┐
│  DjDeck A / B       │  ──── load/play/pause ────▶  │  YouTube Player only   │
│  큐, 볼륨, 크로스..  │                               │  검은 배경 + 전체화면    │
└─────────────────────┘                               └───────────────────────┘
```

**`window.open()`** 으로 `/projection` 경로의 새 브라우저 창을 엽니다. 사용자가 이 창을 외부 모니터로 드래그 → F11 전체화면하면 됩니다.

### BroadcastChannel API

같은 origin(도메인)의 탭/창 간에 메시지를 주고받을 수 있는 브라우저 API입니다.

```typescript
// 보내는 쪽 (메인 창)
const ch = new BroadcastChannel("dj-mixer-projection");
ch.postMessage({ type: "load", videoId: "abc123" });
ch.close();

// 받는 쪽 (프로젝션 창)
const ch = new BroadcastChannel("dj-mixer-projection");
ch.onmessage = (e) => {
  // e.data = { type: "load", videoId: "abc123" }
  player.loadVideoById(e.data.videoId);
};
```

**왜 BroadcastChannel인가?**
- `window.postMessage()`는 열린 창의 참조가 필요하고, 창이 닫혔다 다시 열리면 참조가 끊김
- BroadcastChannel은 채널 이름만 같으면 어떤 탭이든 통신 가능
- 창을 닫고 다시 열어도 자동으로 연결됨

### 메시지 타입

```typescript
type ProjectionMessage =
  | { type: "load"; videoId: string }  // 영상 로드 + 재생
  | { type: "play" }                    // 재생 재개
  | { type: "pause" }                   // 일시정지
  | { type: "stop" };                   // 정지
```

### 프로젝션 창의 준비 순서 처리

프로젝션 창이 열리는 동안 YouTube Player가 아직 로드되지 않았을 수 있습니다. 이때 메시지가 유실되지 않도록 **pending queue** 패턴을 사용합니다:

```typescript
const pendingRef = useRef<ProjectionMessage[]>([]);

function handleMessage(msg) {
  if (!player) {
    pendingRef.current.push(msg);  // 아직 준비 안됐으면 쌓아둠
    return;
  }
  // 정상 처리
}

// onReady 콜백에서 쌓인 메시지 일괄 처리
onReady: () => {
  pendingRef.current.forEach(handleMessage);
  pendingRef.current = [];
};
```

### 프로젝션 전용 레이아웃

`/projection` 경로에 별도 `layout.tsx`를 두면 메인 레이아웃(헤더, 테마 등)을 상속받지 않고 검은 배경만 표시할 수 있습니다. Next.js App Router는 경로별로 중첩 레이아웃을 지원합니다.

---

## 6. 커스텀 슬라이더 스타일링

### 브라우저 기본 range input 스타일 제거

`<input type="range">`는 브라우저마다 기본 스타일이 다릅니다. 커스텀하려면 먼저 기본 스타일을 제거해야 합니다:

```css
input[type="range"] {
  -webkit-appearance: none;  /* Chrome, Safari */
  appearance: none;          /* 표준 */
}
```

그 다음 **트랙**(레일)과 **썸**(드래그하는 바)을 각각 스타일링합니다:

```css
/* 트랙 — Webkit(Chrome/Safari)과 Firefox 각각 별도 선택자 */
::-webkit-slider-runnable-track { ... }
::-moz-range-track { ... }

/* 썸 */
::-webkit-slider-thumb { ... }
::-moz-range-thumb { ... }
```

### 세로 슬라이더

CSS `writing-mode: vertical-lr` + `direction: rtl`을 사용하면 가로 range input을 세로로 회전할 수 있습니다. `rtl`은 위쪽이 최대값이 되도록 방향을 뒤집습니다.

### 테마별 슬라이더 색상

CSS 변수를 활용해 다크/라이트 모드에서 썸 색상을 다르게 적용합니다:
- 라이트 모드: 진한 다크 썸(`#222`) + 흰 테두리
- 다크 모드: 밝은 화이트 썸(`#f0f0f0`) + 검정 테두리

---

## 7. 파일 구조 정리

```
src/app/
├── lib/
│   ├── youtube.ts     ← YT API 타입 + 로드 유틸
│   ├── parseUrl.ts    ← YouTube URL 파싱
│   ├── projection.ts  ← BroadcastChannel 메시지 타입 + 전송 유틸
│   └── types.ts       ← Track, DeckId 공통 타입
├── components/
│   ├── ThemeToggle.tsx ← (Phase 1)
│   ├── YouTubePlayer.tsx ← YT IFrame 래퍼
│   ├── TrackInput.tsx    ← URL 입력 UI (덱별 개별 배치)
│   ├── DjDeck.tsx        ← 덱 (플레이어+컨트롤+볼륨+프로젝션 연동)
│   ├── Queue.tsx         ← 큐 목록 UI (덱과 분리된 별도 영역)
│   └── Crossfader.tsx    ← 크로스페이더 슬라이더
├── projection/
│   ├── layout.tsx        ← 프로젝션 전용 레이아웃 (헤더 없음, 검은 배경)
│   └── page.tsx          ← 프로젝션 페이지 (YouTube Player만 전체화면)
└── page.tsx              ← 메인 페이지 (상태 관리 + 레이아웃 조합)
```
