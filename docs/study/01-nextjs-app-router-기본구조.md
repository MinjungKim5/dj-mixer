# Next.js App Router 기본 구조

## 파일 기반 라우팅

Next.js는 `src/app/` 폴더 안의 파일 구조가 곧 URL 경로가 됩니다.

```
src/app/
├── layout.tsx    ← 모든 페이지를 감싸는 공통 레이아웃
├── page.tsx      ← "/" 경로의 페이지
├── globals.css   ← 전역 스타일
└── about/
    └── page.tsx  ← "/about" 경로의 페이지 (예시)
```

- `page.tsx`가 있는 폴더 = 하나의 라우트
- `layout.tsx`는 해당 폴더와 하위 폴더의 모든 페이지를 감싸는 껍데기

## layout.tsx가 하는 일

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- `<html>`, `<body>` 태그는 **루트 layout에서만** 작성합니다
- `children`에 현재 경로의 `page.tsx` 내용이 들어옵니다
- 헤더, 네비게이션 등 모든 페이지에 공통으로 보일 요소를 여기에 둡니다

## 서버 컴포넌트 vs 클라이언트 컴포넌트

Next.js App Router의 컴포넌트는 기본적으로 **서버 컴포넌트**입니다.

| | 서버 컴포넌트 (기본) | 클라이언트 컴포넌트 |
|---|---|---|
| 선언 | 별도 선언 불필요 | 파일 최상단에 `"use client"` |
| 실행 위치 | 서버에서 HTML로 렌더링 | 브라우저에서 실행 |
| useState/useEffect | 사용 불가 | 사용 가능 |
| 이벤트 핸들러 (onClick 등) | 사용 불가 | 사용 가능 |
| 용도 | 데이터 fetching, 정적 UI | 인터랙티브 UI, 브라우저 API |

### 이 프로젝트에서의 예시

- `layout.tsx` — 서버 컴포넌트. HTML 껍데기와 메타데이터를 정의
- `ThemeToggle.tsx` — `"use client"`. 버튼 클릭(onClick)과 상태(useState)가 필요하므로 클라이언트 컴포넌트

## metadata 객체

```tsx
export const metadata: Metadata = {
  title: "DJ Mixer",
  description: "YouTube 기반 더블덱 DJ 믹싱 웹 앱",
};
```

- `layout.tsx`나 `page.tsx`에서 `metadata`를 export하면 Next.js가 자동으로 `<head>`에 `<title>`, `<meta>` 태그를 넣어줍니다
- 직접 `<head>`를 조작할 필요가 없습니다

## suppressHydrationWarning

```tsx
<html suppressHydrationWarning>
```

- 서버에서 렌더링한 HTML과 브라우저에서 렌더링한 결과가 다를 때 React가 경고를 띄우는데, `next-themes`가 테마 클래스를 `<html>`에 동적으로 추가하면서 차이가 생깁니다
- 이 속성은 **해당 태그 한 단계에서만** 경고를 무시합니다 (자식에는 영향 없음)
- `next-themes` 공식 문서에서도 권장하는 패턴입니다
