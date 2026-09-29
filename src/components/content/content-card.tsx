"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDndMonitor, useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { EditStatusBadge } from "@/components/content/badges";
import { PlatformIcons } from "@/components/content/platform-icon";
import { StatusLed } from "@/components/content/status-led";
import {
  EMITTER_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import type { ContentListItem } from "@/lib/hooks/use-contents";
import { calendarDate, isLate, useToday } from "@/lib/dates";

/**
 * Carte draggable (kanban + tray du calendrier). Toute la carte porte les
 * listeners ; le DndContext parent utilise un PointerSensor avec contrainte de
 * distance pour laisser passer les clics. Après un drag, le navigateur émet
 * quand même un `click` sur l'élément sous le pointeur → on le supprime
 * pendant une courte fenêtre (sinon le drop OUVRE la fiche).
 */
/**
 * Après un drag dnd-kit, le navigateur émet un `click` sur l'élément sous le
 * pointeur — ce qui suivrait les <Link> internes (le drop ouvrirait la fiche).
 * Ce hook fournit un onClickCapture qui avale ce clic fantôme.
 */
export function useDragClickGuard(id: string) {
  const suppressClickUntil = useRef(0);
  useDndMonitor({
    onDragEnd(event) {
      if (event.active.id === id) suppressClickUntil.current = Date.now() + 400;
    },
    onDragCancel(event) {
      if (event.active.id === id) suppressClickUntil.current = Date.now() + 400;
    },
  });
  return (e: React.SyntheticEvent) => {
    if (Date.now() < suppressClickUntil.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
}

/**
 * Clic = aperçu latéral, double-clic = fiche en grand (calendrier, kanban,
 * tray). Le clic simple attend 220 ms : sinon l'aperçu s'ouvre au premier clic
 * et son voile avale le second, qui n'atteint jamais la carte.
 */
export function useOpenGestures(id: string, onOpen?: (id: string) => void) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return {
    onClick: () => {
      if (!onOpen) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        onOpen(id);
      }, 220);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      e.preventDefault();
      router.push(`/content/${id}`);
    },
  };
}

export function ContentCard({
  content,
  compact = false,
  onOpen,
  showEmitter = true,
}: {
  content: ContentListItem;
  compact?: boolean;
  /** Si fourni, le clic ouvre un aperçu au lieu de naviguer vers la fiche. */
  onOpen?: (id: string) => void;
  /** Badge émetteur : inutile dans une vue Caroline / Ryse. */
  showEmitter?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: content.id });
  const clickGuard = useDragClickGuard(content.id);
  const gestures = useOpenGestures(content.id, onOpen);
  const today = useToday();
  const late = isLate(content, today);
  const date = calendarDate(content);
  // Peu de texte sur la carte : le format passe dans l'infobulle.
  const tooltip = `${content.title}\n${FORMAT_LABELS[content.format]} · ${STATUS_LABELS[content.status]}`;
  const titleText = <span className="line-clamp-2 leading-snug">{content.title}</span>;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClickCapture={clickGuard}
      onDoubleClick={gestures.onDoubleClick}
      style={
        transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
      }
      className={cn(
        // Carte blanche standard : la couleur ne dit que le statut et le retard.
        "group relative cursor-grab select-none rounded-lg border border-[var(--hairline)] bg-[var(--paper)] shadow-[var(--shadow-card)] transition-shadow hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-hover)] active:cursor-grabbing",
        isDragging && "z-50 opacity-95 shadow-[var(--shadow-hover)]",
        compact ? "p-2 text-[13px]" : "p-2.5 text-[14px]",
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={gestures.onClick}
          className={cn(
            "block w-full text-left font-medium leading-snug hover:underline",
            compact && "text-[11px]",
          )}
          title={tooltip}
        >
          {titleText}
        </button>
      ) : (
        <Link
          href={`/content/${content.id}`}
          className={cn(
            "block font-medium leading-snug hover:underline",
            compact && "text-[11px]",
          )}
          title={tooltip}
          draggable={false}
        >
          {titleText}
        </Link>
      )}
      {/* Ligne du bas : plateformes, montage, puis date, retard et statut. */}
      <div className={cn("flex items-center gap-2", compact ? "mt-1" : "mt-1.5")}>
        <PlatformIcons
          platforms={content.platforms}
          muted
          iconClassName="size-3"
          className="text-[var(--ink)] opacity-50"
        />
        <EditStatusBadge status={content["edit-status"]} />
        <span className="ml-auto flex items-center gap-1.5">
          {date && (
            <span className="tabular-nums text-[10.5px] text-muted-foreground">
              {date.slice(5).replace("-", "/")}
            </span>
          )}
          {late && (
            <span
              className="size-2 rounded-full bg-[var(--late)] ring-2 ring-[var(--late)]/15"
              title="En retard"
            />
          )}
          <StatusLed
            status={content.status}
            title={showEmitter ? EMITTER_LABELS[content.emitter] : undefined}
          />
        </span>
      </div>
    </div>
  );
}
