"use client";

import { cn } from "@/lib/utils";

/**
 * Aperçu « comme sur LinkedIn » du texte d'un post + compteur.
 * On prend la section « Version publiée » si elle existe (fiches migrées),
 * sinon tout le corps hors titres markdown et hors « ## Notes ».
 */
export const LINKEDIN_HOOK_CHARS = 210;
export const LINKEDIN_MAX_CHARS = 3000;

export function extractPostText(body: string): string {
  // Jusqu'au prochain « ## » ou la fin du texte (pas la fin de ligne).
  const published = body.match(/^##\s*Version publiée[ \t]*\r?\n([\s\S]*?)(?=^##\s|(?![\s\S]))/im);
  let text = published ? published[1] : body;
  if (!published) {
    // Retire la section Notes (brief interne) et les titres de section.
    text = text.replace(/^##\s*Notes\s*$[\s\S]*?(?=^##\s|(?![\s\S]))/im, "");
    text = text.replace(/^#{1,6}\s+.*$/gm, "");
  }
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function PostPreview({ body, className }: { body: string; className?: string }) {
  const text = extractPostText(body);
  const count = text.length;
  const hook = text.slice(0, LINKEDIN_HOOK_CHARS);
  const rest = text.slice(LINKEDIN_HOOK_CHARS);
  const over = count > LINKEDIN_MAX_CHARS;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className={cn("font-mono", over && "text-[var(--peach)]")}>
          {count.toLocaleString("fr-FR")} / {LINKEDIN_MAX_CHARS.toLocaleString("fr-FR")} caractères
        </span>
        <span>
          Accroche visible avant « …voir plus » : {LINKEDIN_HOOK_CHARS} caractères
        </span>
        {over && <span className="text-[var(--peach)]">Trop long pour LinkedIn</span>}
      </div>
      {text ? (
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-5 py-4 text-[14px] leading-relaxed">
          <p className="whitespace-pre-wrap break-words">
            {hook}
            {rest && (
              <>
                <span className="mx-1 rounded bg-[rgba(235,116,87,0.15)] px-1 font-mono text-[10px] text-[var(--peach)]">
                  …voir plus
                </span>
                <span className="text-foreground/75">{rest}</span>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Rien à prévisualiser : écris le post dans la note.</p>
      )}
    </div>
  );
}
