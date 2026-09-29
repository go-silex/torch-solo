"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRules, saveRules } from "@/lib/hooks/use-rules";
import { useThemes } from "@/lib/hooks/use-themes";
import { themesInRange } from "@/lib/types/theme";
import { WEEKDAYS, WEEKDAY_LABELS, type Rhythm, type Rules } from "@/lib/types/rules";
import { useToday, weekRange } from "@/lib/dates";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Rules : le rythme de la semaine et les règles qu'on se donne. Tout vit dans
 * `_Config/Rules.md`, donc le même fichier s'ouvre dans Obsidian.
 */

/** Le thème de la semaine en cours : c'est lui qui chapeaute le rythme. */
function ThemeOfTheWeek() {
  const today = useToday();
  const { themes } = useThemes();
  const week = weekRange(today);
  const current = themesInRange(themes, week.start, week.end);

  return (
    <Link
      href="/calendar"
      className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[rgba(62,123,196,0.07)] px-4 py-3 text-[13.5px] transition-colors hover:bg-[rgba(62,123,196,0.13)]"
    >
      <span className="micro-label text-muted-foreground">Cette semaine</span>
      {current.length > 0 ? (
        <span className="font-medium">{current.map((t) => t.label).join(" · ")}</span>
      ) : (
        <span className="text-muted-foreground">
          aucun thème — pose-le sur le calendrier
        </span>
      )}
      <ArrowUpRight className="ml-auto size-4 text-muted-foreground" />
    </Link>
  );
}

function RulesEditor({ initial }: { initial: Rules }) {
  const [rhythm, setRhythm] = useState<Rhythm>(initial.rhythm);
  const [body, setBody] = useState(initial.body);
  const [savedBody, setSavedBody] = useState(initial.body);
  const [busy, setBusy] = useState(false);
  const dirty = body !== savedBody;

  /** Le rythme s'enregistre à la sortie du champ ; le corps au bouton. */
  async function commitRhythm(next: Rhythm) {
    try {
      await saveRules({ rhythm: next });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Enregistrement impossible", "error");
    }
  }

  async function saveBody() {
    setBusy(true);
    try {
      await saveRules({ body });
      setSavedBody(body);
      toast("Règles enregistrées");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Enregistrement impossible", "error");
    }
    setBusy(false);
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-[18px] tracking-tight">Le rythme de la semaine</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Ce que porte chaque jour. Torch le rappelle sur le calendrier, sous le thème.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          {WEEKDAYS.map((day) => (
            <label key={day} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[13px] text-muted-foreground">
                {WEEKDAY_LABELS[day]}
              </span>
              <input
                value={rhythm[day] ?? ""}
                onChange={(e) => setRhythm({ ...rhythm, [day]: e.target.value })}
                onBlur={() => commitRhythm(rhythm)}
                placeholder="—"
                className="h-9 flex-1 rounded-lg border border-transparent bg-transparent px-2.5 text-[13.5px] outline-none transition-colors hover:border-[var(--hairline)] focus:border-[var(--sky)] focus:bg-[var(--paper)] placeholder:text-muted-foreground/50"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-[18px] tracking-tight">Les règles</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Markdown libre. Le même texte s&apos;ouvre dans Obsidian.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!dirty && (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Check className="size-3.5" /> à jour
              </span>
            )}
            <Button onClick={saveBody} disabled={!dirty || busy}>
              {busy ? "…" : "Enregistrer"}
            </Button>
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          className={cn(
            "mt-4 min-h-[22rem] w-full resize-y rounded-xl border border-[var(--hairline)] bg-[var(--paper-deep)]/40 p-4",
            "font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-[var(--sky)] focus:bg-[var(--paper)]",
          )}
        />
      </section>
    </>
  );
}

export default function RulesPage() {
  const { rules, isLoading, error } = useRules();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-[2rem] leading-tight">Rules</h1>
        <p className="text-sm text-muted-foreground">
          Le rythme qu&apos;on se donne, sous le thème de la semaine. Tout est dans{" "}
          <code className="font-mono text-[12px]">
            Torch/_Config/Rules.md
          </code>
          .
        </p>
      </div>

      <ThemeOfTheWeek />

      {error && (
        <p className="text-sm text-[var(--peach)]">Erreur : {String(error.message ?? error)}</p>
      )}
      {isLoading && !rules && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {rules && <RulesEditor initial={rules} />}
    </div>
  );
}
