import type { Metadata } from "next";
import Link from "next/link";
import { Oswald, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      className={`${oswald.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-field text-card">
        <header className="bg-field-dark border-b-2 border-amber">
          <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link
              href="/"
              className="font-display font-bold uppercase tracking-[0.08em] text-2xl text-card hover:text-amber transition-colors"
            >
              MLB <span className="text-seam">Stats</span>
            </Link>
            <nav className="flex gap-5 flex-wrap text-sm font-display uppercase tracking-wide">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-card/80 hover:text-amber transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
