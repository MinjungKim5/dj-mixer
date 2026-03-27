# Phase 3 부가기능 학습 노트

## 1. 재생 배속 조절 (Playback Rate)

### YouTube IFrame API의 배속 지원

YouTube IFrame API는 배속 관련 메서드를 기본 제공합니다:

```typescript
player.setPlaybackRate(1.5);          // 1.5배속으로 설정
player.getPlaybackRate();              // 현재 배속 반환
player.getAvailablePlaybackRates();    // 사용 가능한 배속 배열 반환 (예: [0.25, 0.5, 1, 1.5, 2])
```

**주의**: YouTube는 정확히 지원하는 배속 값만 허용합니다. `setPlaybackRate(1.3)` 같은 임의 값을 넣으면 가장 가까운 지원 배속으로 자동 반올림됩니다.

### 상태를 page.tsx에서 관리하는 이유

배속 슬라이더를 크로스페이더 좌우에 배치하기 위해, 배속 상태(`rateA`, `rateB`)는 page.tsx에서 관리합니다. DjDeck 컴포넌트 내부에 두면 크로스페이더 영역에서 접근할 수 없기 때문입니다.

```
page.tsx (rateA, rateB 상태 소유)
├── DjDeck A ← playbackRate={rateA} prop 전달
├── DjDeck B ← playbackRate={rateB} prop 전달
└── 배속 슬라이더 A + 크로스페이더 + 배속 슬라이더 B
```

DjDeck에서는 `useEffect`로 `playbackRate` prop이 바뀔 때 플레이어에 적용합니다:

```typescript
useEffect(() => {
  playerRef.current?.setPlaybackRate(playbackRate);
}, [playbackRate]);
```

### 슬라이더 값 변환

슬라이더는 정수값(25~200)을 사용하고, 표시/적용 시 100으로 나눠 실수(0.25~2.00)로 변환합니다. `<input type="range">`는 정수 step이 더 부드럽게 동작하기 때문입니다.

---

## 2. 크로스페이더 명령어 입력

### 명령어 문법

```
l    → 즉시 왼쪽 끝(-1)으로
r    → 즉시 오른쪽 끝(1)으로
m    → 즉시 중앙(0)으로
l:N  → N×100ms에 걸쳐 왼쪽 끝으로 이동
r:N  → N×100ms에 걸쳐 오른쪽 끝으로 이동
m:N  → N×100ms에 걸쳐 중앙으로 이동
```

시간(`:N`)이 없으면 즉시 이동, 있으면 ease-in-out 애니메이션으로 이동합니다.

**예시**: `l:10` → 1초에 걸쳐 왼쪽 끝으로, `m:15` → 1.5초에 걸쳐 중앙으로

### 애니메이션 구현 (setInterval + ease-in-out)

`requestAnimationFrame` 대신 `setInterval`을 사용한 이유:
- 정확한 시간 제어가 필요 (N×100ms)
- React state 업데이트가 매 프레임 필요하므로 RAF의 장점이 크지 않음

```typescript
const steps = Math.round(durationMs / 16);  // ~60fps
const intervalMs = durationMs / steps;

animRef.current = setInterval(() => {
  step++;
  const progress = step / steps;
  const eased = easeInOut(progress);  // 부드러운 가감속
  onChange(startValue + delta * eased);
}, intervalMs);
```

### ease-in-out 공식

```typescript
progress < 0.5
  ? 2 * progress * progress              // 전반: 가속
  : 1 - Math.pow(-2 * progress + 2, 2) / 2  // 후반: 감속
```

이 공식은 CSS의 `ease-in-out`과 유사한 곡선을 만듭니다. 0에서 시작해 중간에서 가장 빠르고, 1에 도달하면서 감속합니다.

### ref로 interval을 관리하는 이유

```typescript
const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

- `useState`로 interval ID를 저장하면 리렌더가 발생
- ref는 리렌더 없이 값을 유지하므로 interval 관리에 적합
- 새 명령어 실행 시 기존 interval을 정리(`stopAnimation`)하고 새로 시작

### Escape로 긴급 정지

애니메이션 도중 Escape 키를 누르면 `stopAnimation()`이 호출되어 interval이 정리되고, 크로스페이더가 현재 위치에서 멈춥니다.

---

## 3. 레이아웃 구성

```
┌─ SPEED A ─┐  ┌── Crossfader ──┐  ┌─ SPEED B ─┐
│ ━━●━━ 1.00x│  │ A ━━━━●━━━━ B  │  │ ━━●━━ 1.00x│
│   reset    │  └────────────────┘  │   reset    │
└────────────┘                      └────────────┘
              ┌─ CMD ─────────────┐
              │ [l:10, r:30, m  ] │
              └───────────────────┘
```

- 배속 슬라이더는 `w-28 shrink-0`으로 고정 폭, 크로스페이더는 `flex-1 max-w-sm`으로 남은 공간 차지
- 명령어 입력은 `mx-auto`로 중앙 정렬
- 배속 슬라이더에는 타임라인과 동일한 `dj-timeline` 클래스를 재사용 (작은 원형 썸)

---

## 4. 자동 재생 모드 (Auto Mode)

### 구조: Context로 layout ↔ page 통신

오토모드 토글은 헤더(layout.tsx)에, 타이밍 로직은 page.tsx에 있습니다. 둘을 연결하기 위해 React Context를 사용합니다.

```
layout.tsx
└── AutoModeProvider (Context)
    ├── header → AutoModeToggle (Context 읽기/쓰기)
    └── page.tsx (Context 읽기 → 타이밍 로직 실행)
```

layout.tsx는 서버 컴포넌트이지만, 클라이언트 컴포넌트(`AutoModeProvider`)를 자식으로 렌더링할 수 있습니다.

### DjDeck 외부 제어: forwardRef + useImperativeHandle

기존에는 DjDeck이 내부에서만 play/pause를 제어했습니다. 오토모드에서는 page.tsx가 덱을 직접 제어해야 하므로, `forwardRef`로 핸들을 노출합니다:

```typescript
export interface DjDeckHandle {
  play(): void;
  pause(): void;
  cueNext(): void;  // 다음 곡 로드 후 즉시 정지 (스탠바이)
}

const DjDeck = forwardRef<DjDeckHandle, DjDeckProps>(...);
```

page.tsx에서 `deckARef.current.play()` 형태로 호출합니다.

### 시간 정보 상위 전달: onTimeUpdate 콜백

DjDeck의 250ms 폴링에서 `onTimeUpdate?.(currentTime, duration)`을 호출합니다. page.tsx에서는 이 콜백으로 `remaining = duration - currentTime`을 계산하여 트리거 시점을 감지합니다.

### 타이밍 로직: phase 상태 머신

```
idle → (remaining ≤ 8초) → preroll → (remaining ≤ 5초) → fading → (완료) → idle
```

- **idle**: 대기. 매 폴링마다 remaining 확인
- **preroll**: 다음 덱 `play()` 호출. 크로스페이더가 아직 이전 덱 쪽이므로 볼륨은 0
- **fading**: 4초간 크로스페이드 애니메이션 실행. 완료 시 프로젝션 전환 + 이전 덱 `cueNext()`

`autoPhaseRef`를 `useRef`로 관리하는 이유: phase 전환이 폴링 콜백 안에서 일어나므로, state로 관리하면 클로저 문제가 발생합니다. ref는 항상 최신 값을 참조합니다.

### 녹색 글로우 테두리

`box-shadow`의 `inset` + 외부 글로우를 조합합니다:

```css
shadow-[inset_0_0_0_1px_rgba(34,197,94,0.4),0_0_20px_rgba(34,197,94,0.15)]
```

Tailwind의 arbitrary value 문법으로 인라인 box-shadow를 지정합니다. `transition-shadow`로 켜고 끌 때 부드럽게 전환됩니다.

---

## 5. 파일 변경 요약

```
src/app/
├── lib/
│   ├── youtube.ts            ← setPlaybackRate, getPlaybackRate 타입 추가
│   └── automode.ts           ← 새 파일: AutoModeContext + AUTO_CONFIG 상수
├── components/
│   ├── YouTubePlayer.tsx     ← 핸들에 setPlaybackRate, getPlaybackRate 메서드 추가
│   ├── DjDeck.tsx            ← forwardRef로 변환, DjDeckHandle 노출, onTimeUpdate 콜백 추가
│   ├── CrossfaderCommand.tsx ← 새 파일: 명령어 파싱 + 애니메이션
│   ├── AutoModeProvider.tsx  ← 새 파일: Context Provider
│   └── AutoModeToggle.tsx    ← 새 파일: 📼 토글 버튼
├── layout.tsx                ← AutoModeProvider + AutoModeToggle 추가
└── page.tsx                  ← 배속 상태, 오토모드 타이밍 로직, 녹색 글로우
```
