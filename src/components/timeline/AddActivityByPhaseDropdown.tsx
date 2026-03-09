'use client';

import { useState, useRef, useEffect } from 'react';
import type { VenturePhase, PhaseType } from '@/types';

const PHASE_LABELS: Record<PhaseType, string> = {
  explore: 'Explore',
  validate: 'Validate',
  define: 'Define',
  build: 'Build',
  spin_out: 'Spin out',
};

const ACTIVITY_TEMPLATES: Record<PhaseType, string[]> = {
  explore: ['Initial Discovery', 'Solution Ideation', 'Design Partner Feedback'],
  validate: ['Concept Pitch Deck', 'Message-Market Fit Testing', 'Clickable Demo / Prototype'],
  define: [
    'Functional Prototypes',
    'Pilot Testing',
    'Technical Discovery',
    'MVP Definition',
    'Investor Pitch Materials',
  ],
  build: [
    'Key Hires',
    'Build MVP',
    'Launch Website and GTM Motion',
    'Fundraising for Seed Round',
  ],
  spin_out: [],
};

interface AddActivityByPhaseDropdownProps {
  phases: VenturePhase[];
  onAdd: (
    venturePhaseId: number,
    name: string,
    startDate: string,
    endDate: string
  ) => void;
}

export function AddActivityByPhaseDropdown({ phases, onAdd }: AddActivityByPhaseDropdownProps) {
  const [open, setOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<VenturePhase | null>(null);
  const [customName, setCustomName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedPhase(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addActivity = (phase: VenturePhase, name: string) => {
    const start = new Date(phase.start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const endStr = end > new Date(phase.end_date) ? phase.end_date : end.toISOString().slice(0, 10);
    onAdd(phase.id, name, phase.start_date, endStr);
    setCustomName('');
    setSelectedPhase(null);
    setOpen(false);
  };

  if (phases.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
        title="Add activity"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded border border-zinc-200 bg-white py-1 shadow-lg">
          {selectedPhase ? (
            <>
              <button
                onClick={() => setSelectedPhase(null)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <div className="border-t border-zinc-100 px-2 py-1">
                <div className="text-[10px] font-medium uppercase text-zinc-400">
                  Add to {PHASE_LABELS[selectedPhase.phase as PhaseType]}
                </div>
                {ACTIVITY_TEMPLATES[selectedPhase.phase as PhaseType]?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ACTIVITY_TEMPLATES[selectedPhase.phase as PhaseType].map((t) => (
                      <button
                        key={t}
                        onClick={() => addActivity(selectedPhase, t)}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-1">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customName.trim()) {
                        addActivity(selectedPhase, customName.trim());
                      }
                    }}
                    placeholder="Custom activity..."
                    className="flex-1 rounded border border-zinc-200 px-2 py-0.5 text-xs placeholder:text-zinc-400"
                  />
                  <button
                    onClick={() => customName.trim() && addActivity(selectedPhase, customName.trim())}
                    disabled={!customName.trim()}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-2 py-1">
              <div className="text-[10px] font-medium uppercase text-zinc-400">
                Add to phase
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {phases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setSelectedPhase(phase)}
                    className="rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    {PHASE_LABELS[phase.phase as PhaseType]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
