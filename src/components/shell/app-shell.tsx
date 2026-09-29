"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Columns3,
  Library,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateContentDialog } from "@/components/content/create-dialog";
import { CommandPalette } from "@/components/shell/command-palette";
import { Toaster } from "@/lib/toast";
import { useContents } from "@/lib/hooks/use-contents";
import { useStoredPref } from "@/lib/hooks/use-stored-pref";
import { rememberList } from "@/lib/hooks/use-last-list";

const SIDEBAR_STATES = ["open", "collapsed"] as const;

const NAV = [
  { href: "/calendar", label: "Calendrier", icon: Calendar },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/rules", label: "Rules", icon: ScrollText },
  { href: "/performances", label: "Data", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { quarantine } = useContents();
  // Repliée par défaut (place pour le calendrier) ; qui la rouvre la garde ouverte.
  const [sidebar, setSidebar] = useStoredPref("torch.sidebar", "collapsed", SIDEBAR_STATES);
  const collapsed = sidebar === "collapsed";
  // Retenu pour le lien « retour » d'une fiche.
  useEffect(() => rememberList(pathname), [pathname]);

  return (
    <div className="relative z-[1] flex h-screen overflow-hidden">
      <aside
        className={cn(
          "flex shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--hairline)] bg-[rgba(255,255,255,0.78)] py-5 backdrop-blur transition-[width] duration-200",
          collapsed ? "w-[68px] items-center px-2.5" : "w-[248px] px-3.5",
          "scroll-light",
        )}
      >
        <div className={cn("flex items-center gap-2.5", collapsed ? "justify-center" : "px-1")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique, pas d'optimisation runtime dans le conteneur */}
          <img
            src="/logo-flame.png"
            alt=""
            width={34}
            height={34}
            className="size-[34px] shrink-0 rounded-[9px] object-cover"
          />
          {!collapsed && (
            <div>
              <div className="font-display text-[19px] font-semibold tracking-[-0.02em] leading-tight">
                Torch
              </div>
              <div className="micro-label text-muted-foreground">Cockpit éditorial</div>
            </div>
          )}
        </div>

        <div className="w-full">
          {!collapsed && <div className="micro-label px-2 pb-2 text-muted-foreground">Éditorial</div>}
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg py-2 text-[13.5px] transition-colors",
                    collapsed ? "justify-center px-0" : "px-2.5",
                    active
                      ? "border border-[var(--hairline)] bg-[var(--paper)] font-medium text-foreground shadow-[var(--shadow-card)]"
                      : "text-muted-foreground hover:bg-[var(--paper-deep)] hover:text-foreground",
                  )}
                >
                  <Icon className="size-[17px] shrink-0 opacity-85" strokeWidth={active ? 2 : 1.8} />
                  {!collapsed && label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto flex w-full flex-col gap-3">
          <CreateContentDialog
            trigger={
              <button
                title="Nouveau contenu (N)"
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ink)] bg-[var(--ink)] py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1d2939]",
                  collapsed ? "px-0" : "px-3",
                )}
              >
                <Plus className="size-4" /> {!collapsed && "Nouveau contenu"}
              </button>
            }
          />
          <button
            type="button"
            onClick={() => setSidebar(collapsed ? "open" : "collapsed")}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
            className={cn(
              "flex items-center gap-2 rounded-lg py-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--paper-deep)] hover:text-foreground",
              collapsed ? "justify-center px-0" : "px-2.5",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && "Replier"}
          </button>
        </div>
      </aside>

      <CommandPalette />

      <main className="scroll-light relative flex-1 overflow-auto">
        {quarantine.length > 0 && pathname !== "/library" && (
          <Link
            href="/library"
            className="flex items-center gap-2 border-b border-[var(--peach)]/30 bg-[rgba(235,116,87,0.08)] px-8 py-2 text-xs text-[var(--ink)] transition-colors hover:bg-[rgba(235,116,87,0.14)]"
          >
            <AlertTriangle className="size-3.5 text-[var(--peach)]" />
            {quarantine.length} fichier{quarantine.length > 1 ? "s" : ""} en quarantaine dans le
            vault (frontmatter invalide) : voir la Bibliothèque
          </Link>
        )}
        {children}
      </main>
      <Toaster />
    </div>
  );
}
