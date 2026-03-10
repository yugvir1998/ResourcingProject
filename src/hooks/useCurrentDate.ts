'use client';

import { useState, useEffect } from 'react';

function getTodayAtMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/**
 * Returns the current date (at midnight) and triggers a re-render when the
 * calendar date changes (e.g. at midnight). Use this for Today markers and
 * any UI that must reflect the current date when the page is left open.
 */
export function useCurrentDate(): { date: Date } {
  const [date, setDate] = useState(getTodayAtMidnight);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeoutId = setTimeout(() => {
        setDate(getTodayAtMidnight());
        schedule();
      }, getMsUntilMidnight());
    };
    schedule();
    return () => clearTimeout(timeoutId);
  }, []);

  return { date };
}
