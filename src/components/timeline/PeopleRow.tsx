'use client';

import type { Allocation } from '@/types';

interface PeopleRowProps {
  name: string;
  allocations: Allocation[];
  startDate: Date;
  totalDays: number;
}

function dateToOffset(dateStr: string, startDate: Date, totalDays: number): number {
  const startTime = startDate.getTime();
  const dateTime = new Date(dateStr).getTime();
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, ((dateTime - startTime) / totalMs) * 100));
}

export function PeopleRow({ name, allocations, startDate, totalDays }: PeopleRowProps) {
  if (allocations.length === 0) return null;

  return (
    <div className="relative flex h-8 items-center border-b border-zinc-100">
      <div className="absolute inset-0 flex items-center">
        {allocations.map((a) => {
          const left = dateToOffset(a.week_start, startDate, totalDays);
          const width = 4;
          return (
            <div
              key={a.id}
              className="absolute top-1 h-4 rounded bg-indigo-300/80"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                minWidth: 16,
              }}
              title={`${name}: ${a.fte_percentage}% from ${a.week_start}`}
            />
          );
        })}
      </div>
    </div>
  );
}
