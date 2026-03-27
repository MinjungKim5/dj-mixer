# Tailwind 다크모드와 next-themes

## 테마 전환의 원리

테마 전환은 3단계로 동작합니다:

```
1. next-themes가 <html>에 class="dark" 또는 class="light"를 토글
2. Tailwind CSS가 .dark 클래스 여부에 따라 dark: 스타일을 적용
3. CSS 변수(--background 등)가 테마에 따라 바뀌면서 색상이 변경
```

## globals.css 뜯어보기

```css
@import "tailwindcss";

/* Tailwind v4에서 dark 모드를 클래스 기반으로 전환하는 설정 */
@custom-variant dark (&:is(.dark *));

/* 라이트 테마 색상 (기본값) */
:root {
  --background: #ffffff;
  --foreground: #171717;
}

/* 다크 테마 색상 */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```

### @custom-variant dark

- Tailwind v4의 문법입니다
- `dark:bg-black` 같은 클래스가 `<html class="dark">`일 때만 적용되도록 설정
- 이전 버전(v3)에서는 `tailwind.config.js`에 `darkMode: 'class'`로 설정했었습니다

### CSS 변수 방식의 장점

`bg-black dark:bg-white` 대신 `bg-background`처럼 의미 있는 이름으로 쓸 수 있습니다. 테마가 바뀌면 변수값만 바뀌므로 컴포넌트마다 `dark:` 를 반복할 필요가 줄어듭니다.

## next-themes 사용법

### ThemeProvider 설정 (layout.tsx)

```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
  {children}
</ThemeProvider>
```

| 속성 | 설명 |
|---|---|
| `attribute="class"` | `<html>`에 테마를 class로 적용 (Tailwind와 연동) |
| `defaultTheme="dark"` | 처음 방문 시 기본 테마 |
| `enableSystem` | OS의 다크/라이트 설정을 감지하여 자동 적용 |

### ThemeToggle에서 테마 읽기/변경

```tsx
const { theme, setTheme } = useTheme();

// 현재 테마 읽기
theme // "dark" 또는 "light"

// 테마 변경
setTheme("light") // localStorage에 저장 + <html> class 변경
```

### Hydration 문제와 mounted 패턴

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

if (!mounted) return <div className="h-9 w-9" />;
```

왜 이게 필요한가?

1. 서버에서는 `localStorage`에 접근할 수 없어서 현재 테마를 모릅니다
2. 브라우저에서 처음 로드될 때 서버 HTML과 불일치가 발생합니다
3. `mounted`가 `true`가 된 후에야 (= 브라우저에서 실행 중일 때) 테마 아이콘을 보여줍니다
4. 그 전에는 같은 크기의 빈 `div`를 보여서 레이아웃이 흔들리지 않게 합니다
