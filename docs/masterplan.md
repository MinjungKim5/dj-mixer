# DJ Mixer Web App - Master Plan

## 개요

YouTube IFrame API를 활용한 더블덱 DJ 믹싱 웹 앱.
두 개의 YouTube 플레이어를 가로 배치하고, 독립적인 큐 관리와 볼륨 믹싱(크로스페이더)을 통해 간단한 DJ 경험을 제공한다.

## 기술 스택

| 구분       | 선택                 | 비고                          |
| ---------- | -------------------- | ----------------------------- |
| 프레임워크 | Next.js (App Router) | Vercel 배포 최적화            |
| 스타일링   | Tailwind CSS         | 다크/라이트 테마 DJ UI        |
| YouTube    | YouTube IFrame API   | API 키 불필요, 재생/제어 전용 |
| 배포       | Vercel               | zero-config                   |
| DB/Auth    | 없음                 | 클라이언트 전용 앱            |

## 핵심 기능

### 1. 트랙 로딩 (URL 입력)

- 단일 영상 URL → videoId 파싱 → 선택한 덱의 큐에 1곡 추가
- 재생목록 URL → IFrame API로 로드 → `getPlaylist()`로 videoId 배열 추출 → 큐에 전체 추가
- 영상+재생목록 URL → 재생목록 우선 처리

**URL 파싱 로직:**

```
youtube.com/watch?v={videoId}              → 단일 영상
youtube.com/playlist?list={playlistId}     → 재생목록
youtube.com/watch?v={videoId}&list={...}   → 재생목록 전체
youtu.be/{videoId}                         → 단일 영상 (단축 URL)
```

### 2. 덱 (Deck A / Deck B)

각 덱은 독립적으로 동작하며 다음을 포함한다:

- YouTube IFrame 플레이어 (영상 표시)
- 재생 / 일시정지 버튼
- 현재 재생 중인 곡 정보
- 개별 볼륨 슬라이더 (0~100)
- 큐 목록

### 3. 큐 관리

덱별로 독립된 큐를 React state로 관리한다.

```
Queue = [{ videoId, title }, ...]
currentIndex: number
```

- 곡 추가: URL 입력 또는 재생목록에서 추가
- 곡 삭제: 큐에서 개별 곡 제거
- 순서 변경: 위/아래 버튼으로 이동 (MVP), 추후 드래그앤드롭
- 자동 전환: `onStateChange`에서 `ENDED` 감지 → 큐의 다음 곡을 `loadVideoById()`로 로드
- 곡 선택: 큐에서 특정 곡 클릭 시 바로 해당 곡 재생

### 5. 테마 전환 (다크/라이트)

- 우측 상단에 테마 토글 버튼 배치 (해/달 아이콘)
- `next-themes` 라이브러리 사용하여 시스템 테마 감지 + 수동 전환
- 테마 상태는 `localStorage`에 저장하여 새로고침 후에도 유지
- Tailwind CSS `dark:` variant 활용
- **다크 테마**: DJ 스타일 어두운 배경 (기본값)
- **라이트 테마**: 밝은 배경 + 적절한 대비의 컨트롤 UI

### 4. 볼륨 믹싱

- **개별 볼륨**: 각 덱의 볼륨 슬라이더 (0~100), `player.setVolume()`으로 제어
- **크로스페이더**: 좌(A) ↔ 우(B) 슬라이더
  - 중앙: 양쪽 동일 볼륨
  - 좌측으로: A 볼륨 유지, B 볼륨 감소
  - 우측으로: B 볼륨 유지, A 볼륨 감소
- **최종 볼륨 계산**: `실제볼륨 = 개별볼륨 × 크로스페이더비율`

## UI 레이아웃

```
┌──────────────────────────────────────────────────────┐
│                    🎧 DJ Mixer            [🌙/☀️]    │
├──────────────────────────────────────────────────────┤
│  [YouTube URL 입력]              [Deck A] [Deck B]   │
├────────────────────────┬─────────────────────────────┤
│      DECK A            │         DECK B              │
│ ┌────────────────────┐ │ ┌────────────────────┐      │
│ │  YouTube Player    │ │ │  YouTube Player    │      │
│ └────────────────────┘ │ └────────────────────┘      │
│ ▶ ⏸      now: 곡제목  │ ▶ ⏸      now: 곡제목       │
│ Vol: ━━━●━━━          │ Vol: ━━━●━━━                │
│                        │                             │
│ 📋 Queue A            │ 📋 Queue B                  │
│  1. 곡이름    ▲▼ ✕   │  1. 곡이름    ▲▼ ✕         │
│  2. 곡이름    ▲▼ ✕   │  2. 곡이름    ▲▼ ✕         │
│  3. 곡이름    ▲▼ ✕   │  3. 곡이름    ▲▼ ✕         │
├────────────────────────┴─────────────────────────────┤
│           Crossfader: A ━━━━━●━━━━━ B                │
└──────────────────────────────────────────────────────┘
```

## 컴포넌트 구조

```
app/
├── page.tsx                ← 메인 페이지 (단일 페이지 앱)
├── layout.tsx              ← 테마 프로바이더 + 레이아웃, YouTube IFrame API 스크립트 로드
├── globals.css             ← Tailwind + 커스텀 스타일
└── components/
    ├── ThemeToggle.tsx     ← 다크/라이트 테마 전환 토글 버튼
    ├── TrackInput.tsx      ← URL 입력 + 덱 선택 (A/B)
    ├── DjDeck.tsx          ← 플레이어 + 컨트롤 + 큐 통합 컴포넌트
    ├── YouTubePlayer.tsx   ← YouTube IFrame API 래퍼 (ref로 player 인스턴스 노출)
    ├── Queue.tsx           ← 큐 목록 UI (추가/삭제/순서변경)
    └── Crossfader.tsx      ← 크로스페이더 슬라이더
```

## 데이터 흐름

```
URL 입력
  │
  ├─ videoId만 → { videoId, title: 'Video' } → 선택된 덱 큐에 추가
  │
  └─ playlistId → 숨겨진 IFrame에 loadPlaylist()
                 → getPlaylist()로 videoId[] 추출
                 → 각 { videoId, title: 'Track N' } → 선택된 덱 큐에 추가
                    (제목은 재생 시 getVideoData()로 업데이트)

큐 state 변경
  │
  └─ 현재 곡 재생 완료 (ENDED)
     → currentIndex + 1
     → player.loadVideoById(queue[nextIndex].videoId)
     → 재생 시작되면 getVideoData().title로 제목 업데이트
```

## 상태 관리

```typescript
// 각 덱의 상태
interface DeckState {
  queue: Track[]; // 큐에 담긴 트랙 목록
  currentIndex: number; // 현재 재생 중인 트랙 인덱스
  volume: number; // 개별 볼륨 (0~100)
  isPlaying: boolean; // 재생 상태
}

interface Track {
  videoId: string;
  title: string; // 초기엔 'Video', 재생 시 실제 제목으로 갱신
}

// 글로벌 상태
interface MixerState {
  crossfader: number; // -1(A) ~ 0(center) ~ 1(B)
}
```

## 구현 단계

### Phase 1: 프로젝트 세팅

- [x] masterplan.md 작성
- [x] Next.js + Tailwind 보일러플레이트 생성
- [x] 다크/라이트 테마 레이아웃 (next-themes + ThemeToggle)

### Phase 2: 코어 기능

- [x] YouTube IFrame API 래퍼 컴포넌트
- [x] URL 파싱 유틸 (videoId / playlistId 추출)
- [x] 덱 컴포넌트 (플레이어 + 재생 컨트롤)
- [x] 큐 관리 (추가, 삭제, 순서변경, 자동 전환)
- [x] 개별 볼륨 슬라이더
- [x] 크로스페이더
- [x] 프로젝션 출력 (선택한 덱 영상을 외부 모니터/프로젝터에 전체화면 표시, BroadcastChannel 통신)

### Phase 3: 부가기능

- [x] 재생 배속 조절 (0.25x ~ 2x 슬라이더, 크로스페이더 좌우 여백에 배치)
- [x] 크로스페이더 명령어 입력 (`lN` 왼쪽, `rN` 오른쪽, `mN` 중앙 — N은 100ms 단위 시간)
- [x] 자동재생모드 (A↔B 순차재생, 크로스페이드, 프로젝션 자동전환, 📼 토글)

### Phase 4: UI/UX

- [x] 슬라이더 커스텀 스타일링 (두꺼운 트랙, 사각형 썸, 눈금)
- [ ] 드래그앤드롭 큐 순서변경
- [ ] 현재 재생 곡 하이라이트

### Phase 5: 추후 확장 (미포함)

- [ ] YouTube Data API 연동 (제목/썸네일 메타데이터)
- [ ] BPM 감지 / 싱크
- [ ] 이퀄라이저 (Web Audio API)
