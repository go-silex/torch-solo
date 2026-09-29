"use client";

import { useState } from "react";
import {
  Eye,
  Flame as FlameIcon,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarSection } from "@/components/content/field-editors";
import { PERF_FIELDS, PERF_LABELS, PLATFORM_LABELS } from "@/lib/labels";
import type { ContentDetail } from "@/lib/hooks/use-contents";
import type { KeyedMutator } from "swr";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Erreur");
  }
  return json;
}

/** L'instance Flame est déjà portée par l'URL de review — pas de config côté client. */
function flameOrigin(reviewUrl: string | null): string {
  try {
    return new URL(reviewUrl ?? "").origin;
  } catch {
    return "https://flame.gosilex.com";
  }
}

export function FlameSection({
  content,
  mutate,
  saveEditor,
}: {
  content: ContentDetail;
  mutate: KeyedMutator<ContentDetail>;
  saveEditor: (editor: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isVideo = ["episode", "short"].includes(content.format);

  return (
    <SidebarSection title="Montage">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Monteur</Label>
        <Input
          defaultValue={content.editor ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== content.editor) saveEditor(v);
          }}
          onKeyDown={(e) => {
            // Entrée valide sans avoir à sortir du champ (blur → onBlur enregistre).
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="slug du monteur"
          className="h-8"
        />
      </div>
      {content["flame-review-url"] ? (
        <div className="mt-2 flex flex-col gap-2.5 text-sm">
          <div className="flex flex-col gap-0.5">
            <a
              href={content["flame-review-url"]}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[var(--sky)] underline"
            >
              <Eye className="size-3.5" /> Lien de review
            </a>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Lecture seule, sans compte — à envoyer pour faire visionner et
              commenter (Pierre, un client).
            </p>
          </div>

          {content["flame-project"] && content["flame-folder"] && (
            <div className="flex flex-col gap-0.5">
              <a
                href={`${flameOrigin(content["flame-review-url"])}/projects/${content["flame-project"]}?folder=${content["flame-folder"]}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[var(--sky)] underline"
              >
                <Upload className="size-3.5" /> Dossier de dépôt
              </a>
              <p className="text-[11px] leading-tight text-muted-foreground">
                C&apos;est <strong>ce lien</strong> qu&apos;on envoie au monteur :
                il s&apos;y connecte avec son compte Flame et dépose ses versions.
              </p>
            </div>
          )}

          <p className="text-[11px] leading-tight text-muted-foreground">
            Le statut de review remonte ici automatiquement (~5 min).
          </p>
        </div>
      ) : (
        (isVideo || content.editor) && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await post(`/api/contents/${content.id}/flame`);
                  await mutate();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erreur Flame");
                } finally {
                  setBusy(false);
                }
              }}
              className="gap-1.5"
            >
              <FlameIcon className="size-3.5 text-[var(--peach)]" />
              {busy ? "Préparation…" : "Préparer le montage (Flame)"}
            </Button>
          </div>
        )
      )}
      {error && <p className="mt-1 text-xs text-[var(--peach)]">{error}</p>}
    </SidebarSection>
  );
}

export function LinksSection({
  content,
  savePublishedUrl,
}: {
  content: ContentDetail;
  mutate: KeyedMutator<ContentDetail>;
  savePublishedUrl: (platform: string, url: string | null) => void;
}) {
  return (
    <SidebarSection title="Liens publiés">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">URLs publiées</Label>
        {content.platforms.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Choisis d&apos;abord des plateformes.
          </p>
        )}
        {content.platforms.map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <span className="w-20 shrink-0 text-xs">{PLATFORM_LABELS[p]}</span>
            <Input
              defaultValue={content["published-urls"][p] ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (content["published-urls"][p] ?? null)) {
                  savePublishedUrl(p, v);
                }
              }}
              placeholder="URL du post publié"
              className="h-7 font-mono text-[11px]"
            />
          </div>
        ))}
      </div>
    </SidebarSection>
  );
}

export function MetricsSection({
  content,
  mutate,
}: {
  content: ContentDetail;
  mutate: KeyedMutator<ContentDetail>;
}) {
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (content.status !== "published") return null;

  async function save() {
    setBusy(true);
    const metrics: Record<string, Record<string, number | null>> = {};
    for (const [platform, fields] of Object.entries(values)) {
      metrics[platform] = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v.trim() !== "" && !Number.isNaN(Number(v))) {
          metrics[platform][k] = Number(v);
        }
      }
    }
    await fetch(`/api/contents/${content.id}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics, refreshClicks: Boolean(content["shortlink-slug"]) }),
    });
    await mutate();
    setValues({});
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SidebarSection title="Performances (saisie)">
      <div className="flex flex-col gap-2">
        {content.platforms.map((p) => {
          const existing =
            (content.metrics[p] as Record<string, number> | undefined) ?? {};
          return (
            <div key={p}>
              <p className="mb-1 text-xs font-medium">{PLATFORM_LABELS[p]}</p>
              <div className="grid grid-cols-4 gap-1">
                {PERF_FIELDS.map((f) => (
                  <Input
                    key={f}
                    type="number"
                    placeholder={`${PERF_LABELS[f]}${existing[f] !== undefined ? ` (${existing[f]})` : ""}`}
                    value={values[p]?.[f] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [p]: { ...prev[p], [f]: e.target.value },
                      }))
                    }
                    className="h-7 text-[11px]"
                  />
                ))}
              </div>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={busy}
          className="gap-1.5 self-start"
        >
          <RefreshCw className="size-3.5" />
          {saved ? "Enregistré ✓" : busy ? "…" : "Enregistrer les métriques"}
        </Button>
        {content["metrics-updated"] && (
          <p className="text-[10px] text-muted-foreground">
            Dernier relevé : {content["metrics-updated"]}
          </p>
        )}
      </div>
    </SidebarSection>
  );
}
