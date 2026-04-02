import type { VenturePhase } from '@/types';

export function isPhaseIncludedInCapacity(phase: VenturePhase): boolean {
  return phase.hidden_from_capacity !== true;
}

function coercePhaseLookupId(phaseId: number | string | null | undefined): number | null {
  if (phaseId == null || phaseId === '') return null;
  const n = typeof phaseId === 'string' ? parseInt(phaseId, 10) : Number(phaseId);
  return Number.isFinite(n) ? n : null;
}

/** Skip allocation in capacity rollups when tied to a phase hidden from capacity. */
export function isAllocationIncludedInCapacity(
  phaseId: number | string | null | undefined,
  phaseMap: Map<number, VenturePhase>
): boolean {
  const id = coercePhaseLookupId(phaseId);
  if (id == null) return true;
  const phase = phaseMap.get(id);
  if (!phase) return true;
  return isPhaseIncludedInCapacity(phase);
}
