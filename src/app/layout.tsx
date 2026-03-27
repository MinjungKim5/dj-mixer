import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import ThemeToggle from "./components/ThemeToggle";
import AutoModeProvider from "./components/AutoModeProvider";
import AutoModeToggle from "./components/AutoModeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DJ Mixer",
  description: "YouTube 기반 더블덱 DJ 믹싱 웹 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AutoModeProvider>
            <header className="flex items-center justify-between px-6 py-4">
              <h1 className="text-xl font-bold">🎧 DJ Mixer</h1>
              <div className="flex items-center gap-2">
                <AutoModeToggle />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex flex-1 flex-col">{children}</main>
          </AutoModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
