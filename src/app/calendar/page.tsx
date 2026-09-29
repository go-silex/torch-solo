"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImageOff,
  Inbox,
  Plus,
} from "lucide-react";
import {
  ContentCard,
  useDragClickGuard,
  useOpenGestures,
} from "@/components/content/content-card";
import { CreateContentDialog } from "@/components/content/create-dialog";
import { ContentPeek } from "@/components/content/content-peek";
import { EmitterViewGroup, useEmitterView } from "@/components/content/view-tabs";
import { ThemeDialog, ThemeStrip, type ThemeDraft } from "@/components/content/theme-bar";
import {
  EMPTY_FILTERS,
  FilterBar,
  filtersToQuery,
  type Filters,
} from "@/components/content/filter-bar";
import {
  useContents,
  patchContent,
  type ContentListItem,
} from "@/lib/hooks/use-contents";
import { useThemes } from "@/lib/hooks/use-themes";
import { useRules } from "@/lib/hooks/use-rules";
import { rememberQueue } from "@/lib/hooks/use-content-queue";
import { rhythmFor } from "@/lib/types/rules";
import { useStoredPref } from "@/lib/hooks/use-stored-pref";
import {
  addDays,
  calendarDate,
  daysFrom,
  isLate,
  isWeekend,
  monthGrid,
  mondayOf,
  toIso,
  useToday,
  weekRange,
} from "@/lib/dates";
import { PlatformIcons } from "@/components/content/platform-icon";
import { StatusLed } from "@/components/content/status-led";
import { EmitterBadge } from "@/components/content/badges";
import {
  EMITTER_ACCENTS,
  EMITTER_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import { EMITTERS, type Emitter } from "@/lib/types/content";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
/** `rolling` = 7 jours glissants à partir d'aujourd'hui (un jeudi : jeudi → mercredi). */
const MODES = ["day", "week", "rolling", "month"] as const;
type Mode = (typeof MODES)[number];
const MODE_LABELS: Record<Mode, string> = {
  day: "Jour",
  week: "Semaine",
  rolling: "7 jours",
  month: "Mois",
};
const PERIOD_LABELS: Record<Mode, { prev: string; next: string }> = {
  day: { prev: "Jour précédent", next: "Jour suivant" },
  week: { prev: "Semaine précédente", next: "Semaine suivante" },
  rolling: { prev: "7 jours précédents", next: "7 jours suivants" },
  month: { prev: "Mois précédent", next: "Mois suivant" },
};
const IMAGE_PREFS = ["show", "hide"] as const;
/** Vue Jour : une colonne par personne, dans cet ordre. */
const DAY_COLUMNS: Emitter[] = ["caroline", "ryse"];

/**
 * Carte d'un jour : draggable, clic = aperçu latéral. Titre court (2 lignes en
 * mois, 3 sinon), logo de plateforme discret ; format et statut dans l'infobulle.
 */
function EventChip({
  content,
  onOpen,
  dense,
  late,
  showEmitter,
  showImage,
}: {
  content: ContentListItem;
  onOpen: (id: string) => void;
  dense: boolean;
  late: boolean;
  showEmitter: boolean;
  showImage: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: content.id });
  const clickGuard = useDragClickGuard(content.id);
  const gestures = useOpenGestures(content.id, onOpen);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClickCapture={clickGuard}
      onDoubleClick={gestures.onDoubleClick}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={cn(
        // Carte blanche standard : la couleur ne sert qu'au statut et au retard.
        "group relative cursor-grab select-none rounded-lg border border-[var(--hairline)] bg-[var(--paper)] shadow-[var(--shadow-card)] transition-shadow hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-hover)] active:cursor-grabbing",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
        isDragging && "z-50 shadow-lg",
        content.status === "archived" && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={gestures.onClick}
        className="block w-full text-left leading-tight"
        title={`${content.title}\n${FORMAT_LABELS[content.format]} · ${STATUS_LABELS[content.status]}${late ? " · en retard" : ""}`}
      >
        <span
          className={cn(
            "font-medium",
            dense ? "line-clamp-2 text-[12px]" : "line-clamp-3 text-[13px]",
          )}
        >
          {content.title}
        </span>
      </button>
      {!dense && showImage && content.thumbnail && (
        /* eslint-disable-next-line @next/next/no-img-element -- fichier silex-assets servi par une route API */
        <img
          src={`/api/contents/${content.id}/thumbnail/raw`}
          alt=""
          className="mt-1.5 h-16 w-full rounded-md border border-[var(--hairline)] object-cover"
        />
      )}
      {/* Ligne du bas : plateformes à gauche, retard puis statut à droite. */}
      <div className="mt-1.5 flex items-center gap-2">
        <PlatformIcons platforms={content.platforms} muted iconClassName="size-3" className="opacity-50" />
        <span className="ml-auto flex items-center gap-1.5">
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

function DayCell({
  date,
  inMonth,
  isToday,
  isWeekend,
  children,
  onAdd,
  mode,
  dropId,
  header,
  hint,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  children: React.ReactNode;
  onAdd: (date: string) => void;
  mode: Mode;
  /** Vue Jour : une colonne par personne, donc un identifiant de drop par colonne. */
  dropId?: string;
  /** Remplace la pastille de date (vue Jour : le nom de la personne). */
  header?: React.ReactNode;
  /** Rythme du jour (Rules), rappelé à côté de la date. */
  hint?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? `day-${date}` });
  const day = new Date(date + "T00:00:00");
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex flex-col gap-1 border-b border-r border-[var(--hairline-soft)] p-1.5 transition-colors last:border-r-0",
        mode !== "month" ? "min-h-[60vh] gap-1.5 p-2" : "min-h-[7.5rem]",
        !inMonth && "bg-[var(--paper-deep)]/45",
        inMonth && isWeekend && "bg-[var(--paper-deep)]/30",
        isOver && "bg-[var(--mist)]/60",
      )}
    >
      <div className="flex items-center">
        {header ? (
          header
        ) : mode !== "month" ? (
          <span
            className={cn(
              "flex items-baseline gap-1.5 rounded-full px-2 py-0.5 text-xs",
              isToday ? "bg-[var(--ink)] font-semibold text-white" : "text-foreground/70",
            )}
          >
            <span className="micro-label">{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
            <span className="text-sm font-medium">{day.getDate()}</span>
          </span>
        ) : (
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs",
              isToday
                ? "bg-[var(--ink)] font-semibold text-white"
                : inMonth
                  ? "text-foreground/70"
                  : "text-muted-foreground/50",
            )}
          >
            {day.getDate()}
          </span>
        )}
      </div>
      {/* Rythme du jour (Rules) : sa propre ligne, sinon la date le rogne. */}
      {hint && (
        <div className="truncate px-1 text-[11px] leading-tight text-muted-foreground" title={hint}>
          {hint}
        </div>
      )}
      <div className={cn("flex flex-col", mode !== "month" ? "gap-1.5" : "gap-1")}>{children}</div>
      {/* Ajout au bas de la colonne : visible au survol du jour. */}
      <button
        type="button"
        onClick={() => onAdd(date)}
        aria-label={`Ajouter un contenu le ${date}`}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--hairline-strong)] py-1.5 text-[12px] text-muted-foreground opacity-0 transition-opacity hover:bg-[var(--paper-deep)] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Plus className="size-3.5" /> Ajouter
      </button>
    </div>
  );
}

function UnplannedTray({
  children,
  count,
  onAdd,
}: {
  children: React.ReactNode;
  count: number;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unplanned" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[264px] shrink-0 flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] p-3 shadow-[var(--shadow-card)] transition-colors",
        isOver && "border-[var(--sky)] bg-[var(--mist)]/40",
      )}
    >
      <h2 className="micro-label mb-2 flex items-center gap-2 px-1 text-muted-foreground">
        <Inbox className="size-3.5" /> À planifier
        <button
          type="button"
          onClick={onAdd}
          aria-label="Ajouter un contenu à planifier"
          title="Ajouter un contenu (sans date)"
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-[var(--mist)]/70 hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
        <span className="ml-auto rounded-full border border-[var(--hairline-soft)] px-2 py-0.5 font-mono text-[10px]">
          {count}
        </span>
      </h2>
      <div className="scroll-light flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
        {children}
        {count === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            Rien en attente : dépose une carte ici pour la déplanifier.
          </p>
        )}
      </div>
    </div>
  );
}

type Targets = { "weekly-targets": Record<string, Record<string, number>> };

/**
 * Cadence de la semaine affichée : par émetteur, publiés + prévus vs objectif
 * (_Config/Targets.md). Ne montre que les émetteurs qui ont un objectif ou
 * du contenu cette semaine.
 */
function CadenceStrip({
  contents,
  weekDays,
  targets,
  today,
  only,
}: {
  contents: ContentListItem[];
  weekDays: string[];
  targets: Targets | undefined;
  today: string;
  /** Émetteurs affichés (vue ou filtre actif) ; vide = tous. */
  only: Emitter[];
}) {
  const start = weekDays[0];
  const end = weekDays[6];
  const rows = EMITTERS.filter((e) => only.length === 0 || only.includes(e)).map((e) => {
    const mine = contents.filter((c) => c.emitter === e && c.status !== "archived");
    // Même règle que la grille : on compte exactement les cartes affichées.
    const inWeek = (c: ContentListItem) => {
      const d = calendarDate(c);
      return d !== null && d >= start && d <= end;
    };
    const published = mine.filter((c) => c.status === "published" && inWeek(c)).length;
    const planned = mine.filter((c) => c.status !== "published" && inWeek(c)).length;
    const target = Object.values(targets?.["weekly-targets"]?.[e] ?? {}).reduce((a, b) => a + b, 0);
    return { emitter: e as Emitter, published, planned, target };
  }).filter((r) => r.target > 0 || r.published + r.planned > 0);
  const isCurrent = today >= start && today <= end;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rows.map((r) => {
        const total = r.published + r.planned;
        const ok = r.target === 0 || total >= r.target;
        return (
          <div
            key={r.emitter}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
              ok
                ? "border-[var(--hairline)] bg-[var(--paper)]/85"
                : "border-[var(--peach)]/40 bg-[rgba(235,116,87,0.06)]",
            )}
            title={`${r.published} publié(s), ${r.planned} prévu(s)${r.target ? `, objectif ${r.target}/semaine` : ""}`}
          >
            <EmitterBadge emitter={r.emitter} />
            <span className="tabular-nums">
              <span className="font-medium text-[#2f9a68]">
                {r.published} publié{r.published > 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {r.planned} prévu{r.planned > 1 ? "s" : ""}
                {r.target > 0 && ` · objectif ${r.target}`}
              </span>
            </span>
            {!ok && isCurrent && (
              <span className="font-medium text-[var(--peach)]">{r.target - total} à caler</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CalendarPage() {
  const now = new Date();
  const today = useToday();
  const [mode, setMode] = useStoredPref<Mode>("torch.calendar.mode", "week", MODES);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(() => toIso(mondayOf(now)));
  /** Vue 7 jours : nombre de périodes de 7 jours depuis aujourd'hui (0 = à partir d'aujourd'hui). */
  const [rollOffset, setRollOffset] = useState(0);
  /** Vue Jour : le jour affiché. */
  const [dayDate, setDayDate] = useState(() => toIso(now));
  const [images, setImages] = useStoredPref("torch.calendar.images", "show", IMAGE_PREFS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { activeView, effectiveFilters } = useEmitterView(filters, setFilters);
  const query = useMemo(() => filtersToQuery(effectiveFilters), [effectiveFilters]);
  const { contents, mutate, quarantine } = useContents(query);
  const { data: targets } = useSWR<Targets>("/api/targets", fetcher);
  const { themes } = useThemes();
  const { rules } = useRules();
  /** Thème en cours de création / modification (null = dialogue fermé). */
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Quick-add : null = fermé ; { planned } = ouvert (planned null = sans date). */
  const [quickAdd, setQuickAdd] = useState<{ planned: string | null; emitter?: Emitter } | null>(
    null,
  );
  /** Fiche affichée dans le panneau latéral (null = fermé). */
  const [peekId, setPeekId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const weeks = useMemo(() => {
    if (mode === "month") return monthGrid(year, month);
    if (mode === "day") return [[dayDate]];
    return [daysFrom(mode === "week" ? weekStart : addDays(today, 7 * rollOffset))];
  }, [mode, weekStart, dayDate, today, rollOffset, year, month]);

  /** Date d'affichage : publiés à leur date de publication, les autres à leur date prévue. */
  const byDate = useMemo(() => {
    const map = new Map<string, typeof contents>();
    for (const c of contents) {
      const d = calendarDate(c);
      if (!d) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(c);
    }
    return map;
  }, [contents]);

  const unplanned = useMemo(
    () =>
      contents.filter(
        (c) =>
          !c.planned &&
          !c["published-at"] &&
          c.status !== "archived" &&
          c.status !== "published",
      ),
    [contents],
  );

  const late = useMemo(() => contents.filter((c) => isLate(c, today)), [contents, today]);

  /** Vue Jour : une colonne par personne, réduite à la personne sélectionnée. */
  const dayColumns = useMemo(
    () =>
      activeView && activeView !== "all" && DAY_COLUMNS.includes(activeView)
        ? [activeView]
        : DAY_COLUMNS,
    [activeView],
  );

  /**
   * Ordre de lecture des fiches affichées : la grille colonne par colonne,
   * puis le tray. C'est lui que suivent les flèches d'une fiche ouverte.
   */
  const queue = useMemo(() => {
    const ids: string[] = [];
    if (mode === "day") {
      for (const emitter of dayColumns) {
        for (const c of byDate.get(dayDate) ?? []) {
          if (c.emitter === emitter) ids.push(c.id);
        }
      }
    } else {
      for (const week of weeks) {
        for (const date of week) {
          for (const c of byDate.get(date) ?? []) ids.push(c.id);
        }
      }
    }
    for (const c of unplanned) ids.push(c.id);
    return ids;
  }, [mode, dayColumns, dayDate, weeks, byDate, unplanned]);

  useEffect(() => rememberQueue("/calendar", queue), [queue]);

  async function onDragEnd(event: DragEndEvent) {
    const over = event.over?.id;
    const id = event.active.id;
    if (typeof over !== "string" || typeof id !== "string") return;
    setError(null);
    let planned: string | null;
    if (over.startsWith("day-")) planned = over.slice(4).split("::")[0];
    else if (over === "unplanned") planned = null;
    else return;
    const current = contents.find((c) => c.id === id);
    if (!current || current.planned === planned) return;

    // Optimiste : la carte bouge tout de suite, sans attendre le vault.
    await mutate(
      (prev) =>
        prev
          ? {
              ...prev,
              contents: prev.contents.map((c) =>
                c.id === id ? { ...c, planned } : c,
              ),
            }
          : prev,
      { revalidate: false },
    );
    const result = await patchContent(id, { fm: { planned } });
    if (!result.ok) {
      setError(result.error);
      await mutate(); // rollback sur la vérité du vault
    }
  }

  const shownDays = weeks.flat();
  const shownCount = contents.filter((c) => {
    const d = calendarDate(c);
    return d !== null && shownDays.includes(d);
  }).length;
  const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", opts);

  const title =
    mode === "month"
      ? new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : mode === "day"
        ? fmtDate(dayDate, { weekday: "long", day: "numeric", month: "long" })
        : `${fmtDate(shownDays[0], { day: "numeric", month: "short" })} → ${fmtDate(
            shownDays[shownDays.length - 1],
            { day: "numeric", month: "short", year: "numeric" },
          )}`;

  const subtitle =
    mode === "day"
      ? `${shownCount} contenu${shownCount > 1 ? "s" : ""} ce jour`
      : `${shownCount} contenu${shownCount > 1 ? "s" : ""} sur la période`;

  function shift(delta: number) {
    if (mode === "day") {
      setDayDate((d) => addDays(d, delta));
    } else if (mode === "week") {
      setWeekStart((w) => addDays(w, 7 * delta));
    } else if (mode === "rolling") {
      setRollOffset((o) => o + delta);
    } else {
      const d = new Date(year, month + delta, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }

  function goToday() {
    setWeekStart(toIso(mondayOf(now)));
    setDayDate(toIso(now));
    setRollOffset(0);
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  // ← → : période précédente / suivante ; T : aujourd'hui (hors saisie et dialogue).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") shift(-1);
      else if (e.key === "ArrowRight") shift(1);
      else if (e.key === "t" || e.key === "T") goToday();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const navBtn =
    "flex size-9 items-center justify-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground transition-colors hover:border-[var(--sky-soft)] hover:text-foreground";

  return (
    <div className="mx-auto flex max-w-[1840px] flex-col gap-4 px-7 pb-12 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold capitalize leading-tight tracking-[-0.025em]">
            {title}
          </h1>
          <p className="text-[13px] tabular-nums text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] p-0.5">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                title={m === "rolling" ? "7 jours à partir d'aujourd'hui" : undefined}
                className={cn(
                  "h-full rounded-md px-3 text-[13px] transition-colors",
                  m === mode
                    ? "bg-[var(--ink)] font-medium text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          {mode !== "month" && (
            <button
              type="button"
              className={navBtn}
              onClick={() => setImages(images === "show" ? "hide" : "show")}
              aria-pressed={images === "show"}
              aria-label={images === "show" ? "Masquer les images" : "Afficher les images"}
              title={images === "show" ? "Masquer les images" : "Afficher les images"}
            >
              {images === "show" ? <ImageIcon className="size-4" /> : <ImageOff className="size-4" />}
            </button>
          )}
          <button
            className={navBtn}
            onClick={() => shift(-1)}
            aria-label={PERIOD_LABELS[mode].prev}
            title={`${PERIOD_LABELS[mode].prev} (←)`}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            className="h-9 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-4 text-[13px] font-medium transition-colors hover:border-[var(--sky-soft)]"
            onClick={goToday}
            title="Aujourd'hui (T)"
          >
            Aujourd&apos;hui
          </button>
          <button
            className={navBtn}
            onClick={() => shift(1)}
            aria-label={PERIOD_LABELS[mode].next}
            title={`${PERIOD_LABELS[mode].next} (→)`}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="flex flex-wrap items-center gap-3">
        <EmitterViewGroup />
        {/* Semaine ou 7 jours : la cadence compte exactement les jours affichés. */}
        {mode !== "month" && (
          <CadenceStrip
            contents={contents}
            weekDays={weeks[0]}
            targets={targets}
            today={today}
            only={effectiveFilters.emitter}
          />
        )}
        {late.length > 0 && (
          <button
            type="button"
            onClick={() => setPeekId(late[0].id)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--peach)]/40 bg-[rgba(235,116,87,0.08)] px-2.5 py-1.5 text-xs text-[var(--ink)] transition-colors hover:bg-[rgba(235,116,87,0.14)]"
            title={late.map((c) => `${c.planned} · ${c.title}`).join("\n")}
          >
            <AlertTriangle className="size-3.5 text-[var(--peach)]" />
            {late.length} en retard
          </button>
        )}
      </div>

      {error && <p className="text-sm text-[var(--peach)]">{error}</p>}
      {quarantine.length > 0 && (
        <p className="text-xs text-[var(--peach)]">
          {quarantine.length} fichier{quarantine.length > 1 ? "s" : ""} en
          quarantaine : voir la Bibliothèque.
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex items-start gap-5">
          <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] shadow-[var(--shadow-card)]">
            {mode === "month" && (
              <div className="grid grid-cols-7 border-b border-[var(--hairline)] bg-[var(--paper-deep)]">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="micro-label px-3 py-2.5 text-center text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>
            )}
            {mode === "day" ? (
              <div className="group/row">
                <ThemeStrip
                  days={[dayDate]}
                  themes={themes}
                  defaultRange={weekRange(dayDate)}
                  onEdit={(t) => setThemeDraft({ theme: t, start: t.start, end: t.end })}
                  onCreate={setThemeDraft}
                />
                <div className="grid" style={{ gridTemplateColumns: `repeat(${dayColumns.length}, minmax(0, 1fr))` }}>
                {dayColumns.map((emitter) => {
                  const items = (byDate.get(dayDate) ?? []).filter((c) => c.emitter === emitter);
                  return (
                    <DayCell
                      key={emitter}
                      date={dayDate}
                      dropId={`day-${dayDate}::${emitter}`}
                      mode={mode}
                      inMonth
                      isToday={dayDate === today}
                      isWeekend={isWeekend(dayDate)}
                      onAdd={(d) => setQuickAdd({ planned: d, emitter })}
                      header={
                        <span className="flex items-center gap-2 text-[13px] font-medium">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: EMITTER_ACCENTS[emitter] }}
                          />
                          {EMITTER_LABELS[emitter]}
                          <span className="tabular-nums text-[11px] text-muted-foreground">
                            {items.length}
                          </span>
                        </span>
                      }
                    >
                      {items.map((c) => (
                        <EventChip
                          key={c.id}
                          content={c}
                          onOpen={setPeekId}
                          dense={false}
                          late={isLate(c, today)}
                          showEmitter={false}
                          showImage={images === "show"}
                        />
                      ))}
                    </DayCell>
                  );
                })}
                </div>
              </div>
            ) : (
              weeks.map((week, i) => (
              <div key={i} className="group/row">
                <ThemeStrip
                  days={week}
                  themes={themes}
                  placeholder={mode === "month" ? "hover" : "always"}
                  onEdit={(t) => setThemeDraft({ theme: t, start: t.start, end: t.end })}
                  onCreate={setThemeDraft}
                />
                <div className="grid grid-cols-7">
                {week.map((date) => (
                  <DayCell
                    key={date}
                    date={date}
                    mode={mode}
                    inMonth={
                      mode !== "month" || date.slice(5, 7) === String(month + 1).padStart(2, "0")
                    }
                    isToday={date === today}
                    isWeekend={isWeekend(date)}
                    hint={mode === "month" || !rules ? null : rhythmFor(rules.rhythm, date)}
                    onAdd={(d) => setQuickAdd({ planned: d })}
                  >
                    {(byDate.get(date) ?? []).map((c) => (
                      <EventChip
                        key={c.id}
                        content={c}
                        onOpen={setPeekId}
                        dense={mode === "month"}
                        late={isLate(c, today)}
                        showEmitter={activeView === "all" || activeView === null}
                        showImage={images === "show"}
                      />
                    ))}
                  </DayCell>
                ))}
                </div>
              </div>
              ))
            )}
          </div>
          <UnplannedTray count={unplanned.length} onAdd={() => setQuickAdd({ planned: null })}>
            {unplanned.map((c) => (
              <ContentCard
                key={c.id}
                content={c}
                onOpen={setPeekId}
                showEmitter={activeView === "all" || activeView === null}
              />
            ))}
          </UnplannedTray>
        </div>
      </DndContext>

      <ContentPeek id={peekId} onClose={() => setPeekId(null)} />
      <ThemeDialog draft={themeDraft} onClose={() => setThemeDraft(null)} />

      {quickAdd && (
        <CreateContentDialog
          open
          onOpenChange={(o) => !o && setQuickAdd(null)}
          navigateOnCreate={false}
          defaults={
            quickAdd.planned || quickAdd.emitter
              ? {
                  ...(quickAdd.planned ? { planned: quickAdd.planned } : {}),
                  ...(quickAdd.emitter ? { emitter: quickAdd.emitter } : {}),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
