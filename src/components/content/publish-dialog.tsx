"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformIcon } from "@/components/content/platform-icon";
import { PLATFORM_LABELS } from "@/lib/labels";
import { patchContent, type ContentListItem } from "@/lib/hooks/use-contents";
import { linkedinPostDate, publishedDateFromUrls } from "@/lib/published-date";

/**
 * « Marquer publié » : URL du post par plateforme + date, en un seul geste
 * (statut published, published-at, published-urls).
 */
export function PublishDialog({
  content,
  open,
  onOpenChange,
  onDone,
}: {
  content: ContentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void | Promise<unknown>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(
    content["published-at"] ?? publishedDateFromUrls(content["published-urls"]) ?? today,
  );
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      content.platforms.map((p) => [p, content["published-urls"][p] ?? ""]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const cleaned: Record<string, string | null> = { ...content["published-urls"] };
    for (const [p, url] of Object.entries(urls)) cleaned[p] = url.trim() || null;
    const result = await patchContent(content.id, {
      fm: { status: "published", "published-at": date, "published-urls": cleaned },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onDone?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-[var(--hairline)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] tracking-tight">
            Marquer comme publié
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            Publié le
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-40"
            />
          </label>
          {content.platforms.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aucune plateforme sur cette fiche : le statut passera en Publié sans URL.
            </p>
          )}
          {content.platforms.map((p) => (
            <label key={p} className="flex items-center gap-2 text-xs">
              <span className="flex w-28 shrink-0 items-center gap-1.5 text-muted-foreground">
                <PlatformIcon platform={p} /> {PLATFORM_LABELS[p]}
              </span>
              <Input
                value={urls[p] ?? ""}
                onChange={(e) => {
                  const url = e.target.value;
                  setUrls((u) => ({ ...u, [p]: url }));
                  // Coller l'URL LinkedIn remplit la vraie date de publication.
                  const fromUrl = p === "linkedin" ? linkedinPostDate(url) : null;
                  if (fromUrl) setDate(fromUrl);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="URL du post"
                className="h-8 font-mono text-[11px]"
                autoFocus={p === content.platforms[0]}
              />
            </label>
          ))}
          {error && <p className="text-xs text-[var(--peach)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={submit}
              disabled={busy}
              className="gap-1.5 bg-[#2f9a68] text-white hover:bg-[#27835a]"
            >
              <Send className="size-3.5" /> {busy ? "…" : "Publié"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
