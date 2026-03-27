# Phase 4 UI/UX + YouTube Data API 학습 노트

## 1. YouTube Data API v3 클라이언트 호출

### API 키 사용 방식

이 프로젝트에서는 Next.js API Route를 거치지 않고 **클라이언트에서 직접** YouTube Data API를 호출합니다. 앱 전체가 클라이언트 사이드로 동작하므로 일관성을 유지하기 위한 선택입니다.

```typescript
const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
```

`NEXT_PUBLIC_` 접두사가 붙은 환경변수는 빌드 시 클라이언트 번들에 포함됩니다. 로컬 전용 앱이므로 키 노출 위험은 무시합니다.

### videos.list — 단일 영상 메타데이터

```typescript
const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
```

- **quota cost**: 1 unit
- 응답에서 `items[0].snippet.title`과 `items[0].snippet.thumbnails.default.url`을 추출
- 영상이 없으면 `items`가 빈 배열 → 에러 처리

### playlistItems.list — 재생목록 영상 목록

```typescript
const params = new URLSearchParams({
  part: "snippet",
  playlistId,
  maxResults: "50",  // 한 페이지 최대 50개
  key: API_KEY,
});
```

- **quota cost**: 1 unit per page
- 한 번에 최대 50개까지 반환, `nextPageToken`으로 다음 페이지 요청
- `snippet.resourceId.videoId`로 각 영상의 videoId를 추출
- 비공개/삭제된 영상은 `snippet.title`이 "Private video" 또는 "Deleted video" → 필터링

### 페이지네이션 패턴

```typescript
let pageToken: string | undefined;
while (tracks.length < MAX_ITEMS) {
  if (pageToken) params.set("pageToken", pageToken);
  const data = await fetch(...).then(r => r.json());
  // ... items 처리 ...
  pageToken = data.nextPageToken;
  if (!pageToken) break;  // 더 이상 페이지 없음
}
```

YouTube API의 페이지네이션은 `pageToken` 기반입니다. 응답의 `nextPageToken`을 다음 요청에 넣으면 다음 페이지를 가져옵니다. 무한 루프 방지를 위해 최대 개수(200)를 제한합니다.

---

## 2. 스마트 큐-인 (Smart Queue-In)

### A/B 교대 분배 로직

재생목록의 영상을 두 큐에 번갈아 넣는 간단한 패턴:

```typescript
tracks.forEach((track, i) => {
  if (i % 2 === 0) tracksA.push(track);
  else tracksB.push(track);
});
onAddTracksA(tracksA);
onAddTracksB(tracksB);
```

짝수 인덱스 → A, 홀수 인덱스 → B. 원곡 순서가 유지되면서 양쪽에 균등 분배됩니다.

### 단일 곡 → 짧은 큐에 자동 추가

```typescript
if (queueALength <= queueBLength) {
  onAddTracksA([track]);
} else {
  onAddTracksB([track]);
}
```

큐 길이(곡 수)를 비교하여 적은 쪽에 추가합니다. 같으면 A가 우선.

### 모달 닫기 패턴

```typescript
// 배경 클릭으로 닫기 (로딩 중이 아닐 때만)
onClick={(e) => {
  if (e.target === e.currentTarget && !loading) onClose();
}}
```

`e.target === e.currentTarget`은 오버레이 자체를 클릭한 경우에만 true. 모달 내부 클릭은 이벤트 버블링으로 올라오지만 target이 다르므로 무시됩니다.

---

## 3. 컴포넌트 구조 변경: TrackInput 이동

### 기존 구조
```
DjDeck (TrackInput 포함)
  └── TrackInput → onAddTrack → page.tsx
```

### 변경 후 구조
```
Queue (TrackInput 포함)
  ├── TrackInput → onAddTrack → page.tsx
  └── [+] 버튼 → onSmartQueue → SmartQueueModal (page.tsx에서 관리)
```

TrackInput은 재생과 무관한 **큐 관리 기능**이므로, DjDeck(재생 컴포넌트)보다 Queue(큐 컴포넌트) 상단에 있는 것이 의미적으로 적합합니다.

DjDeck에서 `onAddTrack` prop을 완전히 제거하여 관심사를 분리했습니다.

---

## 4. HTML5 드래그앤드롭

### 핵심 이벤트 4개

```typescript
// 1. 드래그 시작: 어떤 아이템을 드래그하는지 기록
onDragStart={(e) => {
  setDragIndex(index);
  e.dataTransfer.effectAllowed = "move";
}}

// 2. 드래그 오버: 드롭 허용 + 현재 위치 표시
onDragOver={(e) => {
  e.preventDefault();  // ← 이게 없으면 drop 이벤트가 발생하지 않음!
  setDragOverIndex(index);
}}

// 3. 드롭: 실제 순서 변경 실행
onDrop={(e) => {
  e.preventDefault();
  onReorder(dragIndex, dropIndex);
}}

// 4. 드래그 종료: 상태 초기화 (성공/실패 무관)
onDragEnd={() => {
  setDragIndex(null);
  setDragOverIndex(null);
}}
```

**중요**: `onDragOver`에서 `e.preventDefault()`를 호출하지 않으면 브라우저가 드롭을 허용하지 않습니다. 이것이 HTML5 DnD에서 가장 흔한 실수입니다.

### 시각적 피드백

- 드래그 중인 아이템: `opacity-50` (반투명)
- 드롭 대상 위치: `ring-1 ring-foreground/30` (테두리 강조)
- 드래그 핸들: `⠿` 아이콘으로 드래그 가능함을 표시, `cursor-grab` / `active:cursor-grabbing`

### currentIndex 추적

드래그앤드롭으로 순서가 바뀌면 현재 재생 곡의 인덱스도 조정해야 합니다:

```typescript
const [moved] = newQueue.splice(fromIndex, 1);  // 빼고
newQueue.splice(toIndex, 0, moved);               // 넣기

// currentIndex 조정 (3가지 케이스)
if (currentIndex === fromIndex) {
  // 재생 중인 곡을 옮긴 경우: 새 위치로 따라감
  newIndex = toIndex;
} else if (fromIndex < currentIndex && toIndex >= currentIndex) {
  // 재생 곡 앞의 항목을 뒤로 옮김: 인덱스 1 감소
  newIndex = currentIndex - 1;
} else if (fromIndex > currentIndex && toIndex <= currentIndex) {
  // 재생 곡 뒤의 항목을 앞으로 옮김: 인덱스 1 증가
  newIndex = currentIndex + 1;
}
```

### 모바일 한계

HTML5 DnD는 터치 이벤트를 지원하지 않습니다. 그래서 기존의 ▲▼ 이동 버튼을 제거하지 않고 유지하여 모바일에서도 순서를 변경할 수 있게 했습니다.

---

## 5. 덱 재생 중 너울 애니메이션

### CSS ::before / ::after를 이용한 오버레이

DjDeck 컴포넌트의 배경에 직접 애니메이션을 넣으면 부모의 `bg-foreground/[0.03]`에 가려집니다. 그래서 **의사요소(pseudo-element)**로 오버레이 레이어를 만듭니다:

```css
.deck-wave {
  position: relative;  /* 의사요소의 기준점 */
  overflow: hidden;    /* 넘치는 부분 숨김 */
}
.deck-wave::before {
  content: "";
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 10%;
  z-index: 0;           /* 콘텐츠 아래 */
  pointer-events: none;  /* 클릭 투과 */
  background: linear-gradient(to top, rgba(59,130,246,0.25), transparent);
  animation: deck-wave-1 3s ease-in-out infinite;
}
```

두 겹(`::before`, `::after`)의 그라데이션이 **서로 엇갈린 주기**(3초/4초)로 opacity가 변하며, 두 파동의 위상차가 물결이 넘실거리는 느낌을 만듭니다.

`pointer-events: none`이 중요합니다 — 이게 없으면 오버레이가 아래 요소의 클릭을 가로챕니다.

---

## 6. 키보드 단축키: e.key vs e.code

### 문제: 한글 모드 / Caps Lock

`e.key`는 **입력된 문자**를 반환합니다:
- 한글 모드에서 `a` 키 → `e.key === "ㅁ"` (매칭 안 됨)
- Caps Lock에서 `a` 키 → `e.key === "A"` (매칭 안 됨)

### 해결: e.code (물리적 키 위치)

`e.code`는 키보드의 **물리적 위치**를 반환합니다:
- 한글 모드든 영어든 → `e.code === "KeyA"`
- Caps Lock이든 아니든 → `e.code === "KeyA"`

```typescript
switch (e.code) {
  case "KeyQ": /* 스마트 큐 모달 */ break;
  case "KeyA": /* Deck A 재생/토글 */ break;
  case "KeyB": /* Deck B 재생/토글 */ break;
  case "KeyU": /* Deck A 배속 -0.05 */ break;
  case "KeyI": /* Deck A 배속 +0.05 */ break;
  case "KeyO": /* Deck B 배속 -0.05 */ break;
  case "KeyP": /* Deck B 배속 +0.05 */ break;
}
```

### input 포커스 중 무시

텍스트 입력 중에 단축키가 발동되면 안 되므로, 이벤트 타겟이 `INPUT`이나 `TEXTAREA`이면 무시합니다:

```typescript
const tag = (e.target as HTMLElement)?.tagName;
if (tag === "INPUT" || tag === "TEXTAREA") return;
```

### ref로 최신 값 참조

`useEffect([], [])`의 빈 의존성 배열 때문에 핸들러 함수는 마운트 시점의 클로저에 갇힙니다. `rateA`, `rateB` 같은 state의 최신 값을 읽기 위해 ref를 사용합니다:

```typescript
const rateARef = useRef(rateA);
rateARef.current = rateA;  // 매 렌더마다 갱신

// 핸들러 안에서
setRateA(clamp(rateARef.current - 0.05));  // 항상 최신 값 참조
```

---

## 7. 파일 변경 요약

```
src/app/
├── lib/
│   ├── types.ts              ← Track에 thumbnail? 필드 추가
│   └── youtubeData.ts        ← 새 파일: fetchVideoMetadata, fetchPlaylistTracks
├── components/
│   ├── TrackInput.tsx        ← fetchVideoMetadata 연동, 로딩 상태
│   ├── SmartQueueModal.tsx   ← 새 파일: 재생목록 A/B 분배 모달 (Esc 닫기)
│   ├── Queue.tsx             ← TrackInput 통합, HTML5 DnD, 썸네일, 하이라이트 강화
│   └── DjDeck.tsx            ← TrackInput/onAddTrack 제거, togglePlay 핸들, 너울 애니메이션, ON AIR 상태
├── globals.css               ← dj-playbar(두꺼운 재생바), deck-wave(너울 애니메이션)
└── page.tsx                  ← onReorder, SmartQueueModal, 키보드 단축키(e.code 기반)
```
