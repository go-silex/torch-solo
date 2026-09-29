"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarSection } from "@/components/content/field-editors";
import { useContents, patchContent } from "@/lib/hooks/use-contents";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { Format, Status } from "@/lib/types/content";
import type { ContentDetail } from "@/lib/hooks/use-contents";

type FamilySlot = {
  format: Format;
  expected: number | [number, number];
  children: { id: string; title: string; status: Status }[];
  fulfilled: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function expectedLabel(exp: number | [number, number]): string {
  return Array.isArray(exp) ? `${exp[0]}-${exp[1]}` : String(exp);
}

/** Section « Famille » d'un épisode : checklist waterfall + génération. */
export function EpisodeFamily({ content }: { content: ContentDetail }) {
  const { data, mutate } = useSWR<{ family: FamilySlot[] }>(
    `/api/contents/${content.id}/family`,
    fetcher,
  );
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    await fetch(`/api/contents/${content.id}/family`, { method: "POST" });
    await mutate();
    setBusy(false);
  }

  const family = data?.family ?? [];
  const totalChildren = family.reduce((n, s) => n + s.children.length, 0);

  return (
    <SidebarSection title="Famille (waterfall)">
      <div className="flex flex-col gap-2">
        {family.map((slot) => (
          <div key={slot.format}>
            <p className="flex items-center gap-1.5 text-xs font-medium">
              {slot.fulfilled ? (
                <CheckCircle2 className="size-3.5 text-[var(--silex-secondary)]" />
              ) : (
                <Circle className="size-3.5 text-muted-foreground" />
              )}
              {FORMAT_LABELS[slot.format] ?? slot.format} — {slot.children.length}/
              {expectedLabel(slot.expected)}
            </p>
            <ul className="ml-5 mt-0.5 flex flex-col gap-0.5">
              {slot.children.map((c) => (
                <li key={c.id} className="truncate text-xs">
                  <Link href={`/content/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    · {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {totalChildren === 0 && (
          <p className="text-xs text-muted-foreground">
            Aucun dérivé pour l&apos;instant.
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={busy}
          className="mt-1 gap-1.5 self-start"
        >
          <Sparkles className="size-3.5" />
          {busy ? "Génération…" : "Générer les dérivés manquants"}
        </Button>
      </div>
    </SidebarSection>
  );
}

/** Picker « dérivé de » pour les non-épisodes. */
export function DerivedFromPicker({ content }: { content: ContentDetail }) {
  const { contents } = useContents("format=episode");
  const parent = content["derived-from"];

  return (
    <SidebarSection title="Filiation">
      {parent ? (
        <p className="text-sm">
          Dérivé de{" "}
          <Link href={`/content/${parent}`} className="font-mono text-xs underline">
            {parent}
          </Link>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Contenu totem (ou ad hoc).</p>
      )}
      <select
        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        value={parent ?? ""}
        onChange={(e) =>
          patchContent(content.id, {
            fm: { "derived-from": e.target.value || null },
          })
        }
      >
        <option value="">— aucun épisode parent —</option>
        {contents.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
    </SidebarSection>
  );
}
