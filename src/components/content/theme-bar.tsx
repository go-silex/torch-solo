"use client";

import { useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTheme, deleteTheme, updateTheme } from "@/lib/hooks/use-themes";
import { themeHue, themeTint } from "@/lib/labels";
import { addDays, weekIndex, weekRange } from "@/lib/dates";
import { themesInRange, type Theme } from "@/lib/types/theme";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Thème de la semaine : un bandeau au-dessus des colonnes, qui court sur la
 * période qu'il couvre. Les bornes sont libres, donc un thème peut déborder de
 * la vue — il est alors coupé au bord, sans coin arrondi de ce côté.
 */

/** Place les thèmes en lignes : deux thèmes qui se chevauchent ne se marchent pas dessus. */
function toLanes(themes: Theme[]): { theme: Theme; lane: number }[] {
  const lastEnd: string[] = [];
  return themes.map((theme) => {
    let lane = lastEnd.findIndex((end) => end < theme.start);
    if (lane === -1) lane = lastEnd.length;
    lastEnd[lane] = theme.end;
    return { theme, lane };
  });
}

export function ThemeStrip({
  days,
  themes,
  placeholder = "always",
  defaultRange,
  onEdit,
  onCreate,
}: {
  /** Dates de la rangée, dans l'ordre d'affichage. */
  days: string[];
  themes: Theme[];
  /** `hover` : la ligne « + Thème » n'apparaît qu'au survol (vue Mois, 5 rangées). */
  placeholder?: "always" | "hover";
  /** Bornes proposées à la création (défaut : la rangée affichée). */
  defaultRange?: { start: string; end: string };
  onEdit: (theme: Theme) => void;
  onCreate: (range: { start: string; end: string }) => void;
}) {
  const first = days[0];
  const last = days[days.length - 1];
  const visible = themesInRange(themes, first, last);
  const placed = toLanes(visible);
  const lanes = placed.reduce((n, p) => Math.max(n, p.lane + 1), 0);
  const range = defaultRange ?? { start: first, end: last };

  if (visible.length === 0) {
    return (
      <div className="border-b border-[var(--hairline-soft)] px-1.5 py-1">
        <button
          type="button"
          onClick={() => onCreate(range)}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--hairline)] py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--sky-soft)] hover:bg-[var(--paper-deep)] hover:text-foreground focus-visible:opacity-100",
            placeholder === "hover" && "opacity-0 group-hover/row:opacity-100",
          )}
        >
          <Plus className="size-3" /> Thème
        </button>
      </div>
    );
  }

  return (
    <div
      className="grid gap-1 border-b border-[var(--hairline-soft)] px-1.5 py-1"
      style={{
        gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${lanes}, auto)`,
      }}
    >
      {placed.map(({ theme, lane }) => {
        const from = Math.max(
          0,
          days.findIndex((d) => d >= theme.start),
        );
        const toIndex = days.reduce(
          (acc, d, i) => (d <= theme.end ? i : acc),
          0,
        );
        const openLeft = theme.start < first;
        const openRight = theme.end > last;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onEdit(theme)}
            title={`${theme.label}\n${theme.start} → ${theme.end}\nCliquer pour modifier`}
            style={{
              gridColumn: `${from + 1} / ${toIndex + 2}`,
              gridRow: lane + 1,
              // Couleur déduite de la semaine : deux semaines voisines diffèrent.
              ["--tint" as string]: themeTint(themeHue(weekIndex(theme.start))),
              ["--tint-hover" as string]: themeTint(themeHue(weekIndex(theme.start)), true),
            }}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 bg-[var(--tint)] px-2 py-1 text-[11.5px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--tint-hover)]",
              openLeft ? "rounded-l-none" : "rounded-l-md",
              openRight ? "rounded-r-none" : "rounded-r-md",
            )}
          >
            {!openLeft && <Tag className="size-3 shrink-0 opacity-45" />}
            <span className="truncate">{theme.label}</span>
          </button>
        );
      })}
      {/* Pas de second « + Thème » : une semaine ne porte qu'un fil conducteur.
          Pour le changer, on clique sur celui qui est là. */}
    </div>
  );
}

export type ThemeDraft = { theme?: Theme; start: string; end: string };

/** Création et modification : nom, bornes, suppression. */
export function ThemeDialog({
  draft,
  onClose,
}: {
  draft: ThemeDraft | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && onClose()}>
      {draft && (
        /* Remonté à chaque ouverture : les champs repartent du brouillon. */
        <ThemeForm
          key={draft.theme?.id ?? `${draft.start}:${draft.end}`}
          draft={draft}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ThemeForm({ draft, onClose }: { draft: ThemeDraft; onClose: () => void }) {
  const [label, setLabel] = useState(draft.theme?.label ?? "");
  // Un thème couvre une semaine entière : une seule date à choisir, le lundi.
  const [monday, setMonday] = useState(
    () => weekRange(draft.theme?.start ?? draft.start).start,
  );
  const [busy, setBusy] = useState(false);

  const start = monday;
  const end = addDays(monday, 6);
  const editing = Boolean(draft.theme);
  const invalid = !label.trim() || !monday;

  const spoken = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", opts);

  async function submit() {
    if (invalid) return;
    setBusy(true);
    try {
      const input = { label: label.trim(), start, end };
      if (draft.theme) await updateTheme(draft.theme.id, input);
      else await createTheme(input);
      toast(draft.theme ? "Thème modifié" : "Thème ajouté");
      onClose();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Enregistrement impossible",
        "error",
      );
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.theme) return;
    setBusy(true);
    try {
      await deleteTheme(draft.theme.id);
      toast("Thème supprimé");
      onClose();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Suppression impossible",
        "error",
      );
      setBusy(false);
    }
  }

  const field =
    "h-9 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[13px] tabular-nums outline-none transition-colors focus:border-[var(--sky)]";

  return (
    <DialogContent className="max-w-md gap-0 overflow-clip rounded-2xl border border-[var(--hairline)] p-0 shadow-[0_32px_90px_rgba(3,22,53,0.22)] sm:max-w-md">
      <div className="border-b border-[var(--hairline-soft)] px-6 pb-4 pt-5">
        <DialogHeader className="gap-1">
          <DialogTitle className="font-display text-[22px] leading-tight tracking-tight">
            {editing ? "Thème" : "Thème de la semaine"}
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            Un fil conducteur affiché au-dessus du calendrier.
          </p>
        </DialogHeader>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ex : Recrutement cohorte 1"
          className="mt-4 w-full border-0 border-b border-[var(--hairline)] bg-transparent pb-2 font-display text-lg tracking-tight outline-none transition-colors placeholder:text-[var(--ink)]/30 focus:border-[var(--sky)]"
        />
      </div>
      <div className="flex items-end gap-4 px-6 py-5">
        <label className="flex flex-col gap-1.5">
          <span className="micro-label text-muted-foreground">Semaine</span>
          <input
            type="date"
            value={monday}
            // N'importe quel jour ramène à son lundi : un thème = une semaine.
            onChange={(e) => e.target.value && setMonday(weekRange(e.target.value).start)}
            className={field}
          />
        </label>
        <p className="pb-2 text-[13px] text-muted-foreground">
          {spoken(start, { day: "numeric", month: "long" })} →{" "}
          {spoken(end, { day: "numeric", month: "long" })}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)]/40 px-6 py-4">
        {editing ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-[var(--late)] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Supprimer
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={invalid || busy}
            className="bg-[var(--peach)] text-white hover:bg-[#e0532f]"
          >
            {busy ? "…" : editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
