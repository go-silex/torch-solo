import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/app-shell";

/* DA « Torch clair » : Inter pour l'interface, Inter Tight pour les titres. */
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const interTight = Inter_Tight({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Torch",
  description: "Cockpit éditorial — calendrier, kanban, montage, performances",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn(
        "h-full antialiased font-sans",
        inter.variable,
        interTight.variable,
        jetbrains.variable,
      )}
    >
      <body className="h-full bg-background text-foreground">
        {/* Fond dégradé, fixe, derrière toute l'application */}
        <div className="app-ground" aria-hidden />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
