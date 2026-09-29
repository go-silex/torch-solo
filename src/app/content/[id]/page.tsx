"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EditStatusBadge,
  EmitterBadge,
  PillarBadge,
  StatusBadge,
} from "@/components/content/badges";
import {
  PropertyRow,
  SidebarSection,
  WorkflowStepper,
} from "@/components/content/field-editors";
import {
  DerivedFromPicker,
  EpisodeFamily,
} from "@/components/content/family-section";
import {
  LinksSection,
  MetricsSection,
} from "@/components/content/integrations";
import { ThumbnailBlock } from "@/components/content/thumbnail";
import { PostPreview } from "@/components/content/post-preview";
import { PublishDialog } from "@/components/content/publish-dialog";
import {
  duplicateContent,
  formatSignature,
  patchContent,
  useContent,
  useContents,
} from "@/lib/hooks/use-contents";
import { useLastList } from "@/lib/hooks/use-last-list";
import { useNeighbours } from "@/lib/hooks/use-content-queue";
import { byCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
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
  FORMATS,
  GOALS,
  PILLARS,
  PLATFORMS,
  type ContentPatch,
} from "@/lib/types/content";

export default function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { content, isLoading, mutate } = useContent(id);
  /** Retour vers la vue d'où l'on vient (calendrier par défaut). */
  const back = useLastList();
  const navBtn =
    "flex size-7 items-center justify-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground transition-colors hover:border-[var(--sky-soft)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[var(--hairline)]";
  /**
   * Fiche précédente / suivante. On suit la file mémorisée par la vue d'où
   * l'on vient ; à défaut (lien direct, palette), l'ordre du calendrier.
   */
  const { contents } = useContents();
  const fallback = useMemo(
    () => [...contents].sort(byCalendarDate).map((c) => c.id),
    [contents],
  );
  const nav = useNeighbours(id, fallback);

  const [body, setBody] = useState<string | null>(null);
  const [loadedMtime, setLoadedMtime] = useState<number | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [publishOpen, setPublishOpen] = useState(false);

  // Initialisation à la première charge (pattern « derived state reset »).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (content && loadedFor !== content.id) {
    setLoadedFor(content.id);
    setBody(content.body);
    setTitle(content.title);
    setLoadedMtime(content.mtimeMs);
  }

  const dirty = Boolean(
    content &&
      ((body !== null && body !== content.body) ||
        (title !== null && title !== content.title)),
  );

  async function saveBody(): Promise<boolean> {
    if (!content || body === null || busy) return true;
    setBusy(true);
    setMessage(null);
    setConflict(false);
    const titleChanged = title !== null && title !== content.title;
    const result = await patchContent(
      id,
      {
        fm: titleChanged ? { title } : undefined,
        body,
        ifBodyUnmodifiedSince: loadedMtime ?? undefined,
      },
      // Le corps n'apparaît dans aucune liste : inutile de toutes les recharger
      // pendant qu'on écrit. Un changement de titre, lui, se voit partout.
      { revalidate: titleChanged ? "lists" : "none" },
    );
    if (!result.ok) {
      if (result.status === 409) setConflict(true);
      setMessage(result.error);
      setBusy(false);
      return false;
    } else {
      setLoadedMtime(result.content.mtimeMs);
      // La réponse porte déjà la fiche à jour : on remplit le cache sans requête.
      await mutate(result.content, { revalidate: false });
      setSavedAt(
        new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      );
    }
    setBusy(false);
    return true;
  }

  /** Ne jamais quitter une fiche non enregistrée : un 409 annule le passage. */
  const goToRef = useRef<(target: string | null) => void>(() => {});
  useEffect(() => {
    goToRef.current = async (target) => {
      if (!target || busy) return;
      if (dirty && !conflict && !(await saveBody())) return;
      router.push(`/content/${target}`);
    };
  });
  const goTo = (target: string | null) => goToRef.current(target);

  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  });

  // ⌥← / ⌥→ : fiche précédente / suivante, sauf pendant une saisie.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      if (e.key === "ArrowLeft") goToRef.current(navRef.current.prev);
      else if (e.key === "ArrowRight") goToRef.current(navRef.current.next);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Enregistrement automatique toutes les 30 s tant que la page est ouverte.
   * Le ref porte la version fraîche de la fonction : un setInterval capturerait
   * sinon le `body` du premier rendu et réécrirait un état périmé.
   * En cas de conflit on suspend — sinon le 409 se rejouerait en boucle.
   */
  const autoSaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    autoSaveRef.current = () => {
      if (!dirty || busy || conflict) return;
      void saveBody();
    };
  });
  useEffect(() => {
    const timer = setInterval(() => autoSaveRef.current(), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading && !content) {
    return <div className="p-10 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!content) {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        Fiche introuvable.{" "}
        <Link href="/library" className="underline">
          Retour à la bibliothèque
        </Link>
      </div>
    );
  }

  const archived = content.status === "archived";

  async function saveField(fm: ContentPatch) {
    setMessage(null);
    const result = await patchContent(id, { fm });
    if (!result.ok) setMessage(result.error);
    else await mutate();
  }

  async function reloadFromDisk() {
    const fresh = await mutate();
    if (fresh) {
      setBody(fresh.body);
      setTitle(fresh.title);
      setLoadedMtime(fresh.mtimeMs);
      setConflict(false);
      setMessage(null);
    }
  }

  async function duplicate() {
    setMessage(null);
    try {
      const copy = await duplicateContent(id);
      router.push(`/content/${copy.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Duplication impossible");
    }
  }

  async function deleteContent() {
    const res = await fetch(`/api/contents/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/library");
    } else {
      const json = await res.json().catch(() => null);
      setMessage(json?.error ?? "Suppression impossible");
      setConfirmDelete(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <Link
          href={back.href}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {back.label}
        </Link>
        {nav.total > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(nav.prev)}
              disabled={!nav.prev}
              title="Fiche précédente (⌥←)"
              aria-label="Fiche précédente"
              className={navBtn}
            >
              <ChevronLeft className="size-4" />
            </button>
            {nav.position > 0 && (
              <span className="px-1 text-xs tabular-nums text-muted-foreground">
                {nav.position} / {nav.total}
              </span>
            )}
            <button
              type="button"
              onClick={() => goTo(nav.next)}
              disabled={!nav.next}
              title="Fiche suivante (⌥→)"
              aria-label="Fiche suivante"
              className={navBtn}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* ---------- Bandeau : identité, vignette, état ---------- */}
      <header className="flex gap-5 rounded-2xl border border-[var(--hairline)] bg-[var(--paper)]/85 p-5">
        <ThumbnailBlock content={content} mutate={mutate} />

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <input
                value={title ?? content.title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border-0 bg-transparent p-0 font-display text-[2rem] leading-tight tracking-tight outline-none placeholder:text-muted-foreground/40 focus:outline-none"
                placeholder="Titre du contenu"
              />
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-mono text-[11px] text-muted-foreground">{content.id}</p>
                {formatSignature(content) && (
                  <p className="text-[11px] text-muted-foreground">
                    modifié par {formatSignature(content)}
                  </p>
                )}
                {content.obsidianUrl && (
                  <a
                    href={content.obsidianUrl}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--silex-secondary)] transition-colors hover:bg-[var(--mist)]/50"
                  >
                    <ExternalLink className="size-3" />
                    Ouvrir dans Obsidian
                  </a>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
              {content.status !== "published" && !archived && (
                <button
                  type="button"
                  onClick={() => setPublishOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#2f9a68] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#27835a]"
                >
                  <Send className="size-3.5" /> Marquer publié
                </button>
              )}
              <StatusBadge status={content.status} />
              <EditStatusBadge status={content["edit-status"]} />
            </div>
          </div>

          {/* Workflow + date, sur la même ligne que l'état d'avancement */}
          <div className="flex items-end gap-6 border-t border-[var(--hairline-soft)] pt-4">
            {archived ? (
              <p className="flex-1 text-xs text-muted-foreground">
                Contenu archivé — hors des vues par défaut.
              </p>
            ) : (
              <div className="min-w-0 flex-1">
                <WorkflowStepper
                  current={content.status}
                  onSelect={(status) => saveField({ status })}
                />
              </div>
            )}
            <div className="flex shrink-0 items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Prévu le
                <Input
                  type="date"
                  value={content.planned ?? ""}
                  onChange={(e) => saveField({ planned: e.target.value || null })}
                  className="h-8 w-36 rounded-lg"
                />
              </label>
              <button
                type="button"
                onClick={duplicate}
                title="Dupliquer la fiche"
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-[var(--mist)]/50 hover:text-foreground"
              >
                <Copy className="size-3.5" /> Dupliquer
              </button>
              <button
                type="button"
                onClick={() => saveField({ status: archived ? "idea" : "archived" })}
                title={archived ? "Sortir des archives" : "Archiver"}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-[var(--mist)]/50 hover:text-foreground"
              >
                {archived ? (
                  <>
                    <ArchiveRestore className="size-3.5" /> Désarchiver
                  </>
                ) : (
                  <>
                    <Archive className="size-3.5" /> Archiver
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {message && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-4 py-2.5 text-sm">
          <span>{message}</span>
          {conflict && (
            <Button size="sm" variant="outline" onClick={reloadFromDisk}>
              Recharger depuis le vault
            </Button>
          )}
        </div>
      )}

      {/* ---------- Écriture | classement ---------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex h-7 items-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] p-0.5">
                {(["edit", "preview"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "h-full rounded-md px-2.5 text-[11px] transition-colors",
                      t === tab
                        ? "bg-[var(--ink)] font-medium text-white"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "edit" ? "Note" : "Aperçu du post"}
                  </button>
                ))}
              </div>
              <span className="micro-label text-muted-foreground">
                synchronisée avec Obsidian
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[11px] text-muted-foreground">
                {busy
                  ? "Enregistrement…"
                  : dirty
                    ? "Modifications non enregistrées"
                    : savedAt
                      ? `Enregistré à ${savedAt}`
                      : ""}
              </span>
              <Button
                size="sm"
                onClick={saveBody}
                disabled={!dirty || busy}
                className="gap-1.5 rounded-lg"
              >
                <Save className="size-3.5" />
                Enregistrer
              </Button>
              {confirmDelete ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-[rgba(235,116,87,0.1)] py-1 pl-2.5 pr-1">
                  <span className="text-[11px] text-muted-foreground">
                    Vers _Trash/ ?
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={deleteContent}
                    className="h-7 gap-1 bg-[var(--peach)] px-2 text-[11px] text-white hover:bg-[#e0532f]"
                  >
                    <Trash2 className="size-3" /> Confirmer
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="gap-1.5 rounded-lg text-muted-foreground hover:border-[var(--peach)]/40 hover:text-[var(--peach)]"
                >
                  <Trash2 className="size-3.5" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>
          {tab === "edit" ? (
            <Textarea
              value={body ?? content.body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[520px] resize-y rounded-xl border-[var(--hairline)] bg-[var(--paper)]/85 p-4 font-mono text-[13px] leading-relaxed"
            />
          ) : (
            <PostPreview body={body ?? content.body} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SidebarSection title="Propriétés">
            <PropertyRow
              label="Format"
              values={FORMATS}
              labels={FORMAT_LABELS}
              selected={content.format}
              onSelect={(format) => saveField({ format })}
            />
            <PropertyRow
              label="Writer"
              values={EMITTERS}
              labels={EMITTER_LABELS}
              selected={content.emitter}
              onSelect={(emitter) => saveField({ emitter })}
              renderValue={() => <EmitterBadge emitter={content.emitter} />}
            />
            <PropertyRow
              label="Pilier"
              values={PILLARS}
              labels={PILLAR_LABELS}
              selected={content.pillar}
              onSelect={(pillar) => saveField({ pillar })}
              renderValue={() => <PillarBadge pillar={content.pillar} />}
            />
            <PropertyRow
              label="Catégorie"
              values={CATEGORIES}
              labels={CATEGORY_LABELS}
              selected={content.category ? [content.category] : []}
              // Recliquer la catégorie active la retire.
              onSelect={(category) =>
                saveField({ category: category === content.category ? null : category })
              }
            />
            <PropertyRow
              label="Objectifs"
              values={GOALS}
              labels={GOAL_LABELS}
              selected={content.goals}
              multi
              onSelectMulti={(goals) => saveField({ goals })}
              renderValue={(sel) =>
                sel.length ? sel.map((g) => GOAL_LABELS[g]).join(", ") : "Choisir…"
              }
            />
            <PropertyRow
              label="Plateformes"
              values={PLATFORMS}
              labels={PLATFORM_LABELS}
              selected={content.platforms}
              multi
              onSelectMulti={(platforms) => saveField({ platforms })}
              renderValue={(sel) =>
                sel.length ? sel.map((p) => PLATFORM_LABELS[p]).join(", ") : "Choisir…"
              }
            />
          </SidebarSection>

          {content.format === "episode" ? (
            <EpisodeFamily content={content} />
          ) : (
            <DerivedFromPicker content={content} />
          )}

          <LinksSection
            content={content}
            mutate={mutate}
            savePublishedUrl={(platform, url) =>
              saveField({
                "published-urls": { ...content["published-urls"], [platform]: url },
              })
            }
          />
        </div>
      </div>

      {/* Saisie des performances : large, donc pleine largeur (masquée si non publié). */}
      <MetricsSection content={content} mutate={mutate} />

      {publishOpen && (
        <PublishDialog
          content={content}
          open
          onOpenChange={setPublishOpen}
          onDone={() => mutate()}
        />
      )}
    </div>
  );
}
