'use client';

export type ZoomLevel = 'quarter' | 'month' | 'week';

type AxisDisplayLevel = 'quarters' | 'months' | 'monthsWithWeeks';

const COLUMN_WIDTH_QUARTERS_THRESHOLD = 65;
const COLUMN_WIDTH_WEEKS_THRESHOLD = 160;

interface TimeAxisProps {
  zoom: ZoomLevel;
  startDate: Date;
  endDate: Date;
  columnWidth: number;
}

function getMonthsBetween(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (d <= endMonth) {
    months.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

function getWeeksInMonth(monthStart: Date): Date[] {
  const weeks: Date[] = [];
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const d = new Date(monthStart);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  while (d <= monthEnd) {
    weeks.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

function getWeeksBetween(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  const d = new Date(start);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  const endTime = end.getTime();
  while (d.getTime() <= endTime) {
    weeks.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

function getDisplayLevel(columnWidth: number): AxisDisplayLevel {
  if (columnWidth < COLUMN_WIDTH_QUARTERS_THRESHOLD) return 'quarters';
  if (columnWidth >= COLUMN_WIDTH_WEEKS_THRESHOLD) return 'monthsWithWeeks';
  return 'months';
}

export function TimeAxis({ zoom, startDate, endDate, columnWidth }: TimeAxisProps) {
  const months = getMonthsBetween(startDate, endDate);
  const displayLevel = getDisplayLevel(columnWidth);

  if (displayLevel === 'quarters') {
    const quarters: { q: number; y: number }[] = [];
    const seen = new Set<string>();
    months.forEach((m) => {
      const q = Math.floor(m.getMonth() / 3) + 1;
      const key = `${m.getFullYear()}-Q${q}`;
      if (!seen.has(key)) {
        seen.add(key);
        quarters.push({ q, y: m.getFullYear() });
      }
    });
    return (
      <div className="flex border-b border-zinc-200 bg-zinc-50/80">
        {quarters.map(({ q, y }) => (
          <div
            key={`${y}-Q${q}`}
            className="flex shrink-0 border-r border-zinc-200 px-2 py-2 text-center text-xs font-medium text-zinc-700"
            style={{ width: columnWidth * 3 }}
          >
            Q{q} {y}
          </div>
        ))}
      </div>
    );
  }

  if (displayLevel === 'monthsWithWeeks') {
    return (
      <div className="flex flex-col border-b border-zinc-200 bg-zinc-50/80">
        <div className="flex">
          {months.map((m) => (
            <div
              key={m.toISOString().slice(0, 7)}
              className="flex shrink-0 border-r border-zinc-200 px-2 py-1.5 text-center text-xs font-medium text-zinc-700"
              style={{ width: columnWidth }}
            >
              {m.toLocaleString('default', { month: 'short' })} {m.getFullYear()}
            </div>
          ))}
        </div>
        <div className="flex">
          {months.map((m) => {
            const monthWeeks = getWeeksInMonth(m);
            const weekWidth = columnWidth / Math.max(1, monthWeeks.length);
            return (
              <div key={m.toISOString().slice(0, 7)} className="flex shrink-0 border-r border-zinc-200" style={{ width: columnWidth }}>
                {monthWeeks.map((w) => (
                  <div
                    key={w.toISOString().slice(0, 10)}
                    className="flex shrink-0 border-r border-zinc-100 px-0.5 py-1 text-center text-[10px] text-zinc-500"
                    style={{ width: weekWidth }}
                  >
                    {w.getDate()}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex border-b border-zinc-200 bg-zinc-50/80">
      {months.map((m) => (
        <div
          key={m.toISOString().slice(0, 7)}
          className="flex shrink-0 border-r border-zinc-200 px-2 py-2 text-center text-xs font-medium text-zinc-700"
          style={{ width: columnWidth }}
        >
          {m.toLocaleString('default', { month: 'short' })} {m.getFullYear()}
        </div>
      ))}
    </div>
  );
}

export function getColumnWidth(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'quarter':
      return 80;
    case 'month':
      return 100;
    case 'week':
      return 40;
    default:
      return 100;
  }
}

export function getGridTotalWidth(zoom: ZoomLevel, startDate: Date, endDate: Date): number {
  const months = getMonthsBetween(startDate, endDate);
  const weeks = getWeeksBetween(startDate, endDate);
  const cw = getColumnWidth(zoom);
  if (zoom === 'quarter') {
    const quarters = new Set<string>();
    months.forEach((m) => {
      const q = Math.floor(m.getMonth() / 3) + 1;
      quarters.add(`${m.getFullYear()}-Q${q}`);
    });
    return quarters.size * cw * 3;
  }
  if (zoom === 'month') return months.length * cw;
  return weeks.length * cw;
}

export function getDateRange(phases: { start_date: string; end_date: string }[], milestones: { target_date: string }[]): { start: Date; end: Date } {
  const dates: Date[] = [];
  phases.forEach((p) => {
    dates.push(new Date(p.start_date));
    dates.push(new Date(p.end_date));
  });
  milestones.forEach((m) => dates.push(new Date(m.target_date)));
  if (dates.length === 0) {
    const today = new Date();
    const end = new Date(today);
    end.setFullYear(end.getFullYear() + 1);
    return { start: today, end };
  }
  const start = new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));
  start.setMonth(start.getMonth() - 1);
  end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}
