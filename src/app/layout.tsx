import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "MLB Stats",
  description: "MLB選手・チーム成績検索",
};

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "ホーム" },
  { href: "/players", label: "選手検索" },
  { href: "/leaders", label: "リーダーボード" },
  { href: "/teams", label: "チーム" },
  { href: "/compare", label: "選手比較" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b">
          <nav className="max-w-4xl mx-auto p-6 flex gap-4 flex-wrap text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-blue-600 hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
