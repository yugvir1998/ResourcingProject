/**
 * Brand phase colors - shared across timeline, Kanban, and phase components.
 * Matches design mockup palette.
 */
export const PHASE_COLORS: Record<string, string> = {
  explore: 'bg-[#80E3D1]',
  shape: 'bg-[#9F6AE2]',
  build: 'bg-[#4A7AFF]',
  spin_out: 'bg-[#FFA166]',
  pause: 'border-2 border-dashed border-zinc-300 bg-zinc-100',
};

/** For phase bars with white text (non-pause, non-planned) */
export const PHASE_TEXT_WHITE = 'text-white';

/** Kanban column styles: border + background + title color */
export const KANBAN_PHASE_COLUMN_STYLES = {
  explore: {
    columnClass: 'border-2 border-[#80E3D1] bg-[#80E3D1]/20',
    titleClass: 'text-[#0d9488]',
  },
  shape: {
    columnClass: 'border-2 border-[#9F6AE2] bg-[#9F6AE2]/20',
    titleClass: 'text-[#7c3aed]',
  },
  build: {
    columnClass: 'border-2 border-[#4A7AFF] bg-[#4A7AFF]/20',
    titleClass: 'text-[#2563eb]',
  },
  spin_out: {
    columnClass: 'border-2 border-[#FFA166] bg-[#FFA166]/20',
    titleClass: 'text-[#ea580c]',
  },
  pause: {
    columnClass: 'border-2 border-dashed border-zinc-300 bg-zinc-100/80',
    titleClass: 'text-zinc-600',
  },
  unplanned: {
    columnClass: 'border-2 border-zinc-200 bg-zinc-50/50',
    titleClass: 'text-zinc-600',
  },
} as const;
