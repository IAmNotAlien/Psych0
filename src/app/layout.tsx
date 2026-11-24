import type { Metadata } from "next";
import { JetBrains_Mono, Silkscreen } from "next/font/google";
import "./globals.css";
import "./psych0.css";
import "./psych0-os.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

// pixel display font — ported from the original single-file HTML version
const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "PSYCH0 — hand-crafted web den",
  description: "blog // portfolio // lab — a hand-made, terminal-punk web den on Next.js with a serverless backend and Supabase storage.",
  keywords: ["psych0", "indieweb", "blog", "portfolio", "next.js", "supabase"],
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  openGraph: {
    title: "PSYCH0 — hand-crafted web den",
    description: "blog // portfolio // lab — hand-made web den on Next.js",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // font-variable classes live on <html> so :root-level var() chains resolve
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} ${silkscreen.variable}`}
    >
      <body className="antialiased p0">{children}</body>
    </html>
  );
}
