"use client";

import { useRef, useState } from "react";
import { Download, ImagePlus, Sparkles, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentDetail } from "@/lib/hooks/use-contents";
import type { KeyedMutator } from "swr";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Image du post : importée depuis l'ordinateur (bouton ou glisser-déposer) ou
 * générée par Rocky (rocky.gosilex.com). Le fichier vit dans le Drive
 * silex-assets (Torch_Vignettes/), la fiche ne garde que son chemin.
 */
export function ThumbnailBlock({
  content,
  mutate,
}: {
  content: ContentDetail;
  mutate: KeyedMutator<ContentDetail>;
}) {
  const [busy, setBusy] = useState<"upload" | "rocky" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Change à chaque écriture : le nom de fichier est stable, pas le contenu.
  const [version, setVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const has = Boolean(content.thumbnail);

  async function run(kind: "upload" | "rocky" | "delete", request: () => Promise<Response>) {
    setBusy(kind === "delete" ? null : kind);
    setError(null);
    try {
      const res = await request();
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Erreur image");
      }
      setVersion((v) => v + 1);
      await mutate();
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur image");
    } finally {
      setBusy(null);
    }
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    void run("upload", () =>
      fetch(`/api/contents/${content.id}/thumbnail/upload`, { method: "POST", body: form }),
    );
  }

  const remove = () =>
    run("delete", () => fetch(`/api/contents/${content.id}/thumbnail`, { method: "DELETE" }));

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group relative w-[132px] shrink-0 overflow-hidden rounded-xl border transition-colors",
          dragOver
            ? "border-[var(--sky)] ring-2 ring-[var(--sky)]/30"
            : has
              ? "border-[var(--hairline)]"
              : "border-dashed border-[var(--hairline)] hover:border-[var(--sky-soft)]",
        )}
      >
        <div className="aspect-square w-full">
          {has ? (
            /* eslint-disable-next-line @next/next/no-img-element -- fichier silex-assets servi par une route API, pas d'optimisation Next */
            <img
              src={`/api/contents/${content.id}/thumbnail/raw?v=${version}`}
              alt={`Image : ${content.title}`}
              className="size-full object-cover"
            />
          ) : busy ? (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-[var(--paper-deep)]/60 px-2 text-center">
              <Sparkles className="size-4 animate-pulse text-[var(--peach)]" />
              <span className="text-[10px] leading-tight text-muted-foreground">
                {busy === "rocky" ? (
                  <>
                    Rocky dessine…
                    <br />
                    <span className="opacity-70">~1 min</span>
                  </>
                ) : (
                  "Import…"
                )}
              </span>
            </div>
          ) : (
            <div className="flex size-full flex-col bg-[var(--paper-deep)]/60">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center transition-colors hover:bg-[var(--mist)]/40"
              >
                <ImagePlus className="size-4 text-muted-foreground" />
                <span className="text-[10px] leading-tight text-muted-foreground">
                  Importer une image
                  <br />
                  <span className="opacity-70">ou la glisser ici</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Actions sur l'image existante, discrètes, révélées au survol. */}
        {has && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-[rgba(3,22,53,0.72)] to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title="Remplacer par une image de l'ordinateur"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
              className="rounded-md p-1 text-white/90 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-wait"
            >
              <Upload className="size-3.5" />
            </button>
            <a
              href={`/api/contents/${content.id}/thumbnail/raw?download=1`}
              download
              title="Télécharger l'image"
              className="rounded-md p-1 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
            >
              <Download className="size-3.5" />
            </a>
            <button
              type="button"
              title="Supprimer l'image"
              disabled={busy !== null}
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}

        {has && busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--paper)]/80">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse text-[var(--peach)]" />
              {busy === "rocky" ? "Rocky redessine…" : "Import…"}
            </span>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="flex w-[132px] flex-col gap-1 rounded-lg bg-[rgba(235,116,87,0.08)] p-1.5">
          <span className="text-[10px] leading-tight text-muted-foreground">
            Supprimer l&apos;image ?
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-[var(--mist)]/50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={remove}
              className="flex-1 rounded-md bg-[var(--peach)] px-1.5 py-0.5 text-[10px] text-white hover:bg-[#e0532f]"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="w-[132px] text-[10px] leading-tight text-[var(--peach)]">{error}</p>
      )}
    </div>
  );
}
