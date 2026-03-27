import type { VenturePhase } from '@/types';

export function isPhaseIncludedInCapacity(phase: VenturePhase): boolean {
  return phase.hidden_from_capacity !== true;
}

/** Skip allocation in capacity rollups when tied to a phase hidden from capacity. */
export function isAllocationIncludedInCapacity(
  phaseId: number | null | undefined,
  phaseMap: Map<number, VenturePhase>
): boolean {
  if (phaseId == null) return true;
  const phase = phaseMap.get(phaseId);
  if (!phase) return true;
  return isPhaseIncludedInCapacity(phase);
}
