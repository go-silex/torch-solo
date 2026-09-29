"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Columns3, Library, BarChart3, FileText, Plus } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { CreateContentDialog } from "@/components/content/create-dialog";
import { PlatformIcons } from "@/components/content/platform-icon";
import { EmitterBadge, StatusBadge } from "@/components/content/badges";
import { useContents } from "@/lib/hooks/use-contents";

/**
 * Recherche globale ⌘K : une fiche par son titre (toutes vues confondues),
 * les vues, la création. Ouvert aussi par « / » hors d'un champ de saisie.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { contents } = useContents();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
      } else if (
        (e.key === "n" || e.key === "N") &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !document.querySelector("[role=dialog]")
      ) {
        e.preventDefault();
        setCreating(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const active = contents.filter((c) => c.status !== "archived");
  const archived = contents.filter((c) => c.status === "archived");

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Recherche"
        description="Ouvrir une fiche ou une vue"
        className="sm:max-w-xl"
      >
        <Command className="rounded-none bg-transparent">
          <CommandInput placeholder="Chercher un contenu, une vue…" />
          <CommandList className="max-h-[60vh]">
          <CommandEmpty>Rien trouvé.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              value="nouveau contenu créer"
              onSelect={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus className="size-4" /> Nouveau contenu
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Vues">
            <CommandItem value="vue calendrier" onSelect={() => go("/calendar")}>
              <Calendar className="size-4" /> Calendrier
            </CommandItem>
            <CommandItem value="vue kanban" onSelect={() => go("/kanban")}>
              <Columns3 className="size-4" /> Kanban
            </CommandItem>
            <CommandItem value="vue bibliothèque" onSelect={() => go("/library")}>
              <Library className="size-4" /> Bibliothèque
            </CommandItem>
            <CommandItem value="vue data performances" onSelect={() => go("/performances")}>
              <BarChart3 className="size-4" /> Data
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Contenus">
            {active.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.title} ${c.emitter} ${c.id}`}
                onSelect={() => go(`/content/${c.id}`)}
                className="gap-2"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <PlatformIcons platforms={c.platforms} iconClassName="size-3" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <EmitterBadge emitter={c.emitter} />
                <StatusBadge status={c.status} />
              </CommandItem>
            ))}
          </CommandGroup>
          {archived.length > 0 && (
            <CommandGroup heading="Archivés">
              {archived.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.emitter} ${c.id} archivé`}
                  onSelect={() => go(`/content/${c.id}`)}
                  className="gap-2 opacity-70"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <EmitterBadge emitter={c.emitter} />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          </CommandList>
        </Command>
      </CommandDialog>
      {creating && <CreateContentDialog open onOpenChange={(o) => !o && setCreating(false)} />}
    </>
  );
}
