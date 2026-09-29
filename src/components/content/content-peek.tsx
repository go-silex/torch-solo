"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { isLate, useToday } from "@/lib/dates";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { mutate as globalMutate } from "swr";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CalendarDays,
  Copy,
  ExternalLink,
  Maximize2,
  Send,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EditStatusBadge,
  EmitterBadge,
  PillarBadge,
  StatusBadge,
} from "@/components/content/badges";
import { WorkflowStepper } from "@/components/content/field-editors";
import { PlatformIcon } from "@/components/content/platform-icon";
import { PublishDialog } from "@/components/content/publish-dialog";
import {
  duplicateContent,
  formatSignature,
  patchContent,
  useContent,
} from "@/lib/hooks/use-contents";
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  GOAL_LABELS,
  PLATFORM_LABELS,
} from "@/lib/labels";

/**
 * Panneau latéral de lecture d'une fiche (calendrier) : l'essentiel sans
 * quitter la vue, le statut modifiable, et « Ouvrir la fiche » pour éditer.
 */
export function ContentPeek({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { content, mutate } = useContent(id);
  const today = useToday();
  const late = content ? isLate(content, today) : false;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  /** La copie apparaît dans le bac « À planifier » ; on ferme pour la voir. */
  async function duplicate() {
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      await duplicateContent(content.id);
      toast("Fiche dupliquée, dans « À planifier »");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplication impossible");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "archived" | "idea") {
    if (!content) return;
    setBusy(true);
    setError(null);
    const result = await patchContent(content.id, { fm: { status } });
    if (!result.ok) setError(result.error);
    else {
      await mutate();
      toast(status === "archived" ? "Archivée" : "Désarchivée");
    }
    setBusy(false);
  }

  async function setPlanned(planned: string | null) {
    if (!content || planned === content.planned) return;
    const result = await patchContent(content.id, { fm: { planned } });
    if (!result.ok) setError(result.error);
    else await mutate();
  }

  /** Suppression douce : la note part dans 1_Torch/_Trash/ (récupérable). */
  async function remove() {
    if (!content) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/contents/${content.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(typeof json?.error === "string" ? json.error : "Suppression impossible");
      setBusy(false);
      return;
    }
    void globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/contents"),
      undefined,
      { revalidate: true },
    );
    setBusy(false);
    setConfirmDelete(false);
    toast("Déplacée vers _Trash/");
    onClose();
  }

  function close() {
    setConfirmDelete(false);
    setError(null);
    onClose();
  }

  const quickAction =
    "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-[var(--mist)]/50 hover:text-foreground disabled:opacity-50";

  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent
        overlayClassName="bg-[var(--ink)]/10 supports-backdrop-filter:backdrop-blur-none"
        className="w-full gap-0 overflow-y-auto border-[var(--hairline)] bg-[var(--paper)] shadow-[-12px_0_40px_rgba(3,22,53,0.12)] sm:max-w-md"
      >
        {content ? (
          <>
            <SheetHeader className="gap-3 pb-4">
              {/* Actions rapides : archiver / supprimer sans ouvrir la fiche. */}
              <div className="-mx-1 flex flex-wrap items-center gap-1 pr-9">
                {content.status !== "published" && content.status !== "archived" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPublishOpen(true)}
                    className={`${quickAction} text-[#2f9a68] hover:text-[#27835a]`}
                  >
                    <Send className="size-3.5" /> Marquer publié
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={duplicate}
                  className={quickAction}
                >
                  <Copy className="size-3.5" /> Dupliquer
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(content.status === "archived" ? "idea" : "archived")}
                  className={quickAction}
                >
                  {content.status === "archived" ? (
                    <>
                      <ArchiveRestore className="size-3.5" /> Désarchiver
                    </>
                  ) : (
                    <>
                      <Archive className="size-3.5" /> Archiver
                    </>
                  )}
                </button>
                {confirmDelete ? (
                  <span className="flex items-center gap-1 rounded-md bg-[rgba(235,116,87,0.1)] py-0.5 pl-2 pr-1 text-[11px]">
                    <span className="text-muted-foreground">Vers _Trash/ ?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-[var(--mist)]/60"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={remove}
                      className="rounded bg-[var(--peach)] px-1.5 py-0.5 font-medium text-white hover:bg-[#e0532f] disabled:opacity-50"
                    >
                      {busy ? "…" : "Confirmer"}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    className={`${quickAction} hover:text-[var(--peach)]`}
                  >
                    <Trash2 className="size-3.5" /> Supprimer
                  </button>
                )}
              </div>
              {error && <p className="text-xs text-[var(--peach)]">{error}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={content.status} />
                <EditStatusBadge status={content["edit-status"]} />
                <EmitterBadge emitter={content.emitter} />
                {late && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(235,116,87,0.14)] px-2 py-0.5 text-[11px] font-medium text-[var(--peach)]">
                    <AlertTriangle className="size-3" /> En retard
                  </span>
                )}
              </div>
              <SheetTitle className="font-display text-[1.6rem] leading-tight tracking-tight">
                {content.title}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>{FORMAT_LABELS[content.format]}</span>
                {content.platforms.map((p) => (
                  <span key={p} className="flex items-center gap-1">
                    <PlatformIcon platform={p} /> {PLATFORM_LABELS[p]}
                  </span>
                ))}
                {content["published-at"] ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" /> Publié le {content["published-at"]}
                  </span>
                ) : (
                  <label className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" /> Prévu le
                    <Input
                      type="date"
                      value={content.planned ?? ""}
                      onChange={(e) => setPlanned(e.target.value || null)}
                      className="h-7 w-36 rounded-md text-xs"
                    />
                  </label>
                )}
                {formatSignature(content) && (
                  <span className="text-muted-foreground/80">
                    modifié par {formatSignature(content)}
                  </span>
                )}
              </SheetDescription>
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/content/${content.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--paper)] transition-colors hover:bg-[var(--silex-secondary)]"
                >
                  <Maximize2 className="size-3.5" /> Ouvrir la fiche
                </Link>
                {content.obsidianUrl && (
                  <a
                    href={content.obsidianUrl}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-xs font-medium text-[var(--silex-secondary)] transition-colors hover:bg-[var(--mist)]/50"
                  >
                    <ExternalLink className="size-3.5" /> Obsidian
                  </a>
                )}
              </div>
            </SheetHeader>

            {content.status !== "archived" && (
              <div className="border-y border-[var(--hairline-soft)] px-6 py-4">
                <WorkflowStepper
                  current={content.status}
                  onSelect={async (status) => {
                    const result = await patchContent(content.id, { fm: { status } });
                    if (result.ok) await mutate();
                  }}
                />
              </div>
            )}

            {content.thumbnail && (
              <div className="px-6 pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- fichier silex-assets servi par une route API */}
                <img
                  src={`/api/contents/${content.id}/thumbnail/raw`}
                  alt=""
                  className="max-h-56 w-full rounded-xl border border-[var(--hairline)] object-cover"
                />
              </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-6 py-4 text-xs">
              <dt className="text-muted-foreground">Pilier</dt>
              <dd><PillarBadge pillar={content.pillar} /></dd>
              <dt className="text-muted-foreground">Catégorie</dt>
              <dd>{content.category ? CATEGORY_LABELS[content.category] : "–"}</dd>
              <dt className="text-muted-foreground">Objectifs</dt>
              <dd>{content.goals.length ? content.goals.map((g) => GOAL_LABELS[g]).join(", ") : "–"}</dd>
              {content.shortlink && (
                <>
                  <dt className="text-muted-foreground">Shortlink</dt>
                  <dd>
                    <a href={content.shortlink} target="_blank" rel="noreferrer" className="font-mono underline">
                      {content.shortlink}
                    </a>
                  </dd>
                </>
              )}
              {Object.entries(content["published-urls"])
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <div key={platform} className="contents">
                    <dt className="text-muted-foreground">
                      {PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform}
                    </dt>
                    <dd className="truncate">
                      <a href={url!} target="_blank" rel="noreferrer" className="font-mono underline">
                        {url}
                      </a>
                    </dd>
                  </div>
                ))}
            </dl>

            <div className="border-t border-[var(--hairline-soft)] px-6 py-4">
              <p className="micro-label mb-2 text-muted-foreground">Note</p>
              {content.body.trim() ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground/85">
                  {content.body.trim()}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">Note vide.</p>
              )}
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
        )}
      </SheetContent>
      {content && publishOpen && (
        <PublishDialog
          content={content}
          open
          onOpenChange={setPublishOpen}
          onDone={() => mutate()}
        />
      )}
    </Sheet>
  );
}
