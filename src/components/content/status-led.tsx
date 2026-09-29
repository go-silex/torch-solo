import { STATUS_LABELS } from "@/lib/labels";
import type { Status } from "@/lib/types/content";
import { cn } from "@/lib/utils";

/**
 * Pastille d'avancement. Elle ne dit pas *quel* statut (le libellé et la
 * colonne le disent déjà) mais *où en est* la fiche sur le chemin de la
 * publication, en trois crans lisibles d'un coup d'œil :
 *
 *   vide   — on écrit encore (idée, brouillon)
 *   moitié — prêt pour l'étape suivante (à tourner, tourné, à monter, monté, prêt)
 *   plein  — calé ou parti (planifié, publié)
 *
 * Archivé garde un contour gris : ce n'est pas une étape, c'est une sortie.
 */

const READY = "#2f9a68";
const PENDING = "#98a2b3";
const ARCHIVED = "#c9d1dc";

type Fill = "empty" | "half" | "full";

const FILL: Record<Status, Fill> = {
  idea: "empty",
  draft: "empty",
  "to-shoot": "half",
  shot: "half",
  "to-edit": "half",
  edited: "half",
  ready: "half",
  scheduled: "full",
  published: "full",
  archived: "empty",
};

export function StatusLed({
  status,
  title,
  className,
}: {
  status: Status;
  /** Complète l'infobulle (émetteur, retard…). Le statut y est déjà. */
  title?: string;
  className?: string;
}) {
  const fill = FILL[status];
  const color =
    status === "archived" ? ARCHIVED : fill === "empty" ? PENDING : READY;

  return (
    <svg
      viewBox="0 0 10 10"
      className={cn("size-2.5 shrink-0", className)}
      role="img"
      aria-label={STATUS_LABELS[status]}
    >
      <title>{title ? `${STATUS_LABELS[status]} · ${title}` : STATUS_LABELS[status]}</title>
      <circle
        cx="5"
        cy="5"
        r="3.6"
        fill={fill === "full" ? color : "none"}
        stroke={color}
        strokeWidth="1.6"
      />
      {/* Demi-disque gauche : « prêt, en attente de l'étape suivante ». */}
      {fill === "half" && <path d="M5 1.4 A3.6 3.6 0 0 0 5 8.6 Z" fill={color} />}
    </svg>
  );
}
