# DJ Mixer

YouTube IFrame API를 활용한 더블덱 DJ 믹싱 웹 앱.
두 개의 YouTube 플레이어로 독립적인 큐 관리와 볼륨 믹싱(크로스페이더)을 통해 간단한 DJ 경험을 제공합니다.

## 기술 스택

- **Next.js 16** (App Router)
- **Tailwind CSS 4** (다크/라이트 테마)
- **YouTube IFrame API**
- **next-themes** (테마 전환)

## 시작하기

```bash
pnpm install
pnpm dev
```

[http://localhost:6725](http://localhost:6725)에서 확인할 수 있습니다.

## 주요 기능 (예정)

- 더블 덱 (Deck A / Deck B) 독립 재생
- YouTube URL / 재생목록 로딩
- 덱별 큐 관리 (추가, 삭제, 순서 변경, 자동 전환)
- 개별 볼륨 + 크로스페이더 믹싱
- 다크/라이트 테마 전환

## 배포

```bash
pnpm build
```

Vercel에 zero-config 배포 가능합니다.
