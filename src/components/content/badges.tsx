import { cn } from "@/lib/utils";
import {
  EDIT_STATUS_CHIP,
  EDIT_STATUS_LABELS,
  EMITTER_ACCENTS,
  EMITTER_CHIP,
  EMITTER_LABELS,
  PILLAR_CHIP,
  PILLAR_LABELS,
  STATUS_CHIP,
  STATUS_DOTS,
  STATUS_LABELS,
} from "@/lib/labels";
import type { EditStatus, Emitter, Pillar, Status } from "@/lib/types/content";

const chip =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn(chip, STATUS_CHIP[status])}>
      <span className={cn("size-1.5 rounded-full", STATUS_DOTS[status], status === "published" && "bg-white/70")} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function EditStatusBadge({ status }: { status: EditStatus }) {
  if (status === "none") return null;
  return (
    <span className={cn(chip, EDIT_STATUS_CHIP[status])}>
      🎬 {EDIT_STATUS_LABELS[status]}
    </span>
  );
}

export function EmitterBadge({ emitter }: { emitter: Emitter }) {
  return (
    <span className={cn(chip, EMITTER_CHIP[emitter])}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: EMITTER_ACCENTS[emitter] }}
      />
      {EMITTER_LABELS[emitter]}
    </span>
  );
}

export function PillarBadge({ pillar }: { pillar: Pillar }) {
  return <span className={cn(chip, PILLAR_CHIP[pillar])}>{PILLAR_LABELS[pillar]}</span>;
}
