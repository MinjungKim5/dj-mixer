# 💿 ㅋㅁㅇ

YouTube IFrame API를 활용한 더블덱 DJ 믹싱 웹 앱.
두 개의 YouTube 플레이어로 독립적인 큐 관리와 볼륨 믹싱(크로스페이더)을 통해 간단한 DJ 경험을 제공합니다.

## 기술 스택

- **Next.js 16** (App Router)
- **Tailwind CSS 4** (다크/라이트 테마)
- **YouTube IFrame API** (재생)
- **YouTube Data API v3** (메타데이터/재생목록)
- **next-themes** (테마 전환)

## 시작하기

```bash
pnpm install
```

`.env.local`에 YouTube Data API 키 설정:

```
NEXT_PUBLIC_YOUTUBE_API_KEY=your_api_key_here
```

```bash
pnpm dev
```

[http://localhost:6725](http://localhost:6725)에서 확인할 수 있습니다.

## 주요 기능

- 더블 덱 (Deck A / Deck B) 독립 재생
- YouTube URL 입력으로 큐 추가 (제목/썸네일 자동 로드)
- 재생목록 URL → 스마트 큐-인 (A/B 교대 분배)
- 덱별 큐 관리 (추가, 삭제, 드래그앤드롭 순서 변경, 자동 전환)
- 개별 볼륨 + 크로스페이더 믹싱
- 재생 배속 조절 (0.25x ~ 2x)
- 크로스페이더 명령어 입력 (l/r/m + 시간)
- 자동 재생 모드 (A↔B 크로스페이드 자동 전환)
- 프로젝션 출력 (외부 모니터/프로젝터)
- 키보드 단축키 (한글/CapsLock 무관)
- 다크/라이트 테마 전환

## 키보드 단축키

| 키        | 동작              |
| --------- | ----------------- |
| `Q`       | 스마트 큐-인 모달 |
| `A`       | Deck A 재생/정지  |
| `B`       | Deck B 재생/정지  |
| `U` / `I` | Deck A 배속 -/+   |
| `O` / `P` | Deck B 배속 -/+   |
