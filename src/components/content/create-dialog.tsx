"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createContent } from "@/lib/hooks/use-contents";
import { useStoredPref } from "@/lib/hooks/use-stored-pref";
import { slugifyTitle } from "@/lib/vault/slug";
import { PlatformIcons } from "@/components/content/platform-icon";
import { readStoredView } from "@/components/content/view-tabs";

/** Dernier émetteur choisi, mémorisé par navigateur ; sinon la vue active. */
const FORM_MODES = ["full", "compact"] as const;

const EMITTER_KEY = "torch.create.emitter";
function rememberedEmitter(): Emitter {
  try {
    const v = localStorage.getItem(EMITTER_KEY);
    if (v && (EMITTERS as readonly string[]).includes(v)) return v as Emitter;
  } catch {
    // localStorage indisponible : on retombe sur la vue.
  }
  const view = readStoredView();
  return view === "all" ? "caroline" : view;
}
import {
  CATEGORY_LABELS,
  EMITTER_LABELS,
  FORMAT_LABELS,
  GOAL_LABELS,
  PILLAR_LABELS,
  PLATFORM_LABELS,
} from "@/lib/labels";
import {
  CATEGORIES,
  EMITTERS,
  EMITTER_DIRS,
  FORMATS,
  FORMAT_DIRS,
  GOALS,
  PILLARS,
  PLATFORMS,
  type Category,
  type Emitter,
  type Format,
  type Goal,
  type Pillar,
  type Platform,
} from "@/lib/types/content";

function Pills<T extends string>({
  values,
  labels,
  selected,
  onSelect,
  multi = false,
}: {
  values: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onSelect: (next: T[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => {
        const active = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => {
              if (multi) {
                onSelect(active ? selected.filter((s) => s !== v) : [...selected, v]);
              } else {
                onSelect([v]);
              }
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-[var(--ink)] font-medium text-white"
                : "bg-[var(--paper-deep)]/70 text-muted-foreground hover:bg-[var(--mist)]/70 hover:text-foreground",
            )}
          >
            {labels[v]}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="micro-label text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function CreateContentDialog({
  defaults,
  trigger,
  open: controlledOpen,
  onOpenChange,
  navigateOnCreate = true,
}: {
  defaults?: { planned?: string; emitter?: Emitter; "derived-from"?: string };
  trigger?: React.ReactNode;
  /** Mode contrôlé (ex : quick-add du calendrier) — pas de trigger interne. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** false = rester sur la vue courante après création (quick-add). */
  navigateOnCreate?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Format[]>(["post"]);
  const [emitter, setEmitter] = useState<Emitter[]>(["caroline"]);
  /** Mode rapide : seul le titre est demandé ; « Plus d'options » déplie le reste. */
  /**
   * Formulaire complet par défaut ; qui préfère le mode rapide le garde
   * (mémorisé par navigateur, comme le dernier émetteur choisi).
   */
  const [formMode, setFormMode] = useStoredPref("torch.create.form", "full", FORM_MODES);
  const expanded = formMode === "full";
  const [pillar, setPillar] = useState<Pillar[]>(["none"]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [category, setCategory] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus fiable du champ titre à l'ouverture (l'autoFocus ne prend pas
  // toujours quand le dialog monte déjà ouvert via le portal — le focus
  // resterait alors sur la page et la frappe fermerait la modale).
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        titleRef.current?.focus();
        // Émetteur imposé (colonne de la vue Jour) sinon le dernier utilisé.
        setEmitter([defaults?.emitter ?? rememberedEmitter()]);
        setPlatforms(["linkedin"]);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open, defaults?.emitter]);

  /** Aperçu du fichier vault qui sera créé. */
  const filePreview = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    return `Content/${EMITTER_DIRS[emitter[0]]}/${FORMAT_DIRS[format[0]]}/${date}_${slugifyTitle(title || "…")}.md`;
  }, [emitter, format, title]);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createContent({
        title: title.trim(),
        format: format[0],
        emitter: emitter[0],
        pillar: pillar[0],
        platforms,
        category: category[0] ?? null,
        goals,
        ...(defaults?.planned ? { planned: defaults.planned, status: "idea" } : {}),
        ...(defaults?.["derived-from"] ? { "derived-from": defaults["derived-from"] } : {}),
      });
      try {
        localStorage.setItem(EMITTER_KEY, emitter[0]);
      } catch {
        // Navigation privée : pas mémorisé, rien de grave.
      }
      setOpen(false);
      setTitle("");
      setPlatforms([]);
      setCategory([]);
      setGoals([]);
      if (navigateOnCreate) router.push(`/content/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {controlledOpen === undefined && (
        <span onClick={() => setOpen(true)}>
          {trigger ?? (
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" /> Nouveau contenu
            </Button>
          )}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-xl gap-0 overflow-clip rounded-2xl border border-[var(--hairline)] p-0 shadow-[0_32px_90px_rgba(3,22,53,0.22)] sm:max-w-xl"
        >
          {/* En-tête : titre serif sur halo d'aube */}
          <div className="relative min-w-0 border-b border-[var(--hairline-soft)] px-7 pb-5 pt-6">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(90% 150% at 50% 125%, rgba(242,180,154,0.22) 0%, rgba(168,194,216,0.2) 42%, rgba(107,159,212,0.14) 62%, rgba(254,254,254,0) 88%)",
              }}
              aria-hidden
            />
            <DialogHeader className="relative gap-1">
              <DialogTitle className="font-display text-[28px] leading-tight tracking-tight">
                Nouveau contenu
              </DialogTitle>
              <p className="text-[13px] text-muted-foreground">
                {defaults?.planned
                  ? `Planifié le ${defaults.planned}. Titre, Entrée : le reste se règle après.`
                  : "Titre, Entrée : le reste se règle après."}
              </p>
            </DialogHeader>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Titre — ex : Claude Code pour les dirigeants"
              className="relative mt-4 w-full border-0 border-b border-[var(--hairline)] bg-transparent pb-2 font-display text-xl tracking-tight outline-none transition-colors placeholder:text-[var(--ink)]/30 focus:border-[var(--sky)]"
            />
          </div>

          {/* Corps : résumé en mode rapide, champs complets sinon */}
          <div className="flex min-w-0 flex-col gap-5 px-7 py-5">
            {!expanded && (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-white">
                  {FORMAT_LABELS[format[0]]}
                </span>
                <Pills values={EMITTERS} labels={EMITTER_LABELS} selected={emitter} onSelect={setEmitter} />
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PlatformIcons platforms={platforms} iconClassName="size-3" />
                  {platforms.length ? "" : "sans plateforme"}
                </span>
                <button
                  type="button"
                  onClick={() => setFormMode("full")}
                  className="ml-auto flex items-center gap-1 text-xs text-[var(--silex-secondary)] hover:underline"
                >
                  Plus d&apos;options <ChevronDown className="size-3.5" />
                </button>
              </div>
            )}
            {expanded && (<>
            <button
              type="button"
              onClick={() => setFormMode("compact")}
              className="flex items-center gap-1 self-end text-xs text-muted-foreground hover:text-foreground"
            >
              Moins d&apos;options <ChevronUp className="size-3.5" />
            </button>
            <Field label="Format">
              <Pills values={FORMATS} labels={FORMAT_LABELS} selected={format} onSelect={setFormat} />
            </Field>
            <Field label="Writer">
              <Pills values={EMITTERS} labels={EMITTER_LABELS} selected={emitter} onSelect={setEmitter} />
            </Field>
            <Field label="Pilier">
              <Pills values={PILLARS} labels={PILLAR_LABELS} selected={pillar} onSelect={setPillar} />
            </Field>
            <Field label="Plateformes">
              <Pills
                values={PLATFORMS}
                labels={PLATFORM_LABELS}
                selected={platforms}
                onSelect={setPlatforms}
                multi
              />
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <Field label="Catégorie">
                <Pills
                  values={CATEGORIES}
                  labels={CATEGORY_LABELS}
                  selected={category}
                  // Recliquer la catégorie active la retire (champ facultatif).
                  onSelect={(next) => setCategory(next[0] === category[0] ? [] : next)}
                />
              </Field>
              <Field label="Objectifs">
                <Pills values={GOALS} labels={GOAL_LABELS} selected={goals} onSelect={setGoals} multi />
              </Field>
            </div>
            </>)}
            {error && <p className="text-sm text-[var(--peach)]">{error}</p>}
          </div>

          {/* Pied : aperçu du fichier + actions */}
          <div className="flex min-w-0 items-center justify-between gap-4 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)]/40 px-7 py-4">
            <p className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate" title={filePreview}>
                {filePreview}
              </span>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={submit}
                disabled={!title.trim() || busy}
                className="bg-[var(--peach)] text-white hover:bg-[#e0532f]"
              >
                {busy ? "Création…" : "Créer la fiche"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
