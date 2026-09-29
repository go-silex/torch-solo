import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/shell/app-shell";

/*
 * DA « Torch clair » : Inter pour l'interface, Inter Tight pour les titres.
 * Polices embarquées via npm (pas next/font/google) : le build ne dépend pas
 * d'un téléchargement chez Google, qui échoue de temps en temps.
 */
const fontVars = {
  "--font-sans": '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  "--font-display": '"Inter Tight Variable", "Inter Variable", ui-sans-serif, sans-serif',
  "--font-geist-mono": '"JetBrains Mono Variable", ui-monospace, monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: "Torch",
  description: "Planning de contenus : calendrier, kanban, performances",
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
      className={cn("h-full antialiased font-sans")}
      style={fontVars}
    >
      <body className="h-full bg-background text-foreground">
        {/* Fond dégradé, fixe, derrière toute l'application */}
        <div className="app-ground" aria-hidden />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
