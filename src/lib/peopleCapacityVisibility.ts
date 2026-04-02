import type { Venture } from '@/types';

/**
 * Whether a venture's allocations should count toward People Allocation and related capacity views.
 * Soft-deleted ventures are omitted from GET /api/ventures, so v is typically undefined for those rows.
 *
 * Note: `hidden_from_venture_tracker` only affects the Venture Tracker Kanban (see migration 010), not
 * the Command Center timeline — excluding it here incorrectly dropped capacity for ventures like Oncology.
 */
export function ventureContributesToPeopleCapacity(v: Venture | undefined): boolean {
  if (!v) return false;
  if (v.status === 'backlog') return v.timeline_visible === true;
  // DB default `timeline_visible` is false (migration 005); pre-ex lives in Exploration Staging, not the
  // main timeline, so almost all rows are false — they must still count toward the Pre Exploration bucket.
  if (v.status === 'exploration_staging') return true;
  // Main timeline: hide-from-timeline (explicit false) drops People Allocation too.
  if (v.timeline_visible === false) return false;
  return true;
}
