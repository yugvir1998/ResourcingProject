'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PhaseType } from '@/types';

const ACTIVITY_TEMPLATES: Record<PhaseType, string[]> = {
  explore: ['Initial Discovery', 'Solution Ideation', 'Design Partner Feedback'],
  shape: [
    'Concept Pitch Deck',
    'Message-Market Fit Testing',
    'Clickable Demo / Prototype',
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
  support: [],
  pause: [],
};

const PHASE_LABELS: Record<PhaseType, string> = {
  explore: 'Explore',
  shape: 'Concept',
  build: 'Build',
  spin_out: 'Spin out',
  support: 'Support',
  pause: 'Paused',
};

interface AddActivityDropdownProps {
  phaseId: number;
  phaseType: PhaseType;
  phaseStartDate: string;
  phaseEndDate: string;
  onAdd: (
    venturePhaseId: number,
    name: string,
    startDate: string,
    endDate: string
  ) => void;
  onAddPause?: (afterPhaseId: number) => void;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  compact?: boolean;
}

export function AddActivityDropdown({
  phaseId,
  phaseType,
  phaseStartDate,
  phaseEndDate,
  onAdd,
  onAddPause,
  onClose,
  anchorRef,
  compact = false,
}: AddActivityDropdownProps) {
  const [customName, setCustomName] = useState('');
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const templates = ACTIVITY_TEMPLATES[phaseType];

  useEffect(() => {
    if (open && buttonRef.current) {
      setDropdownRect(buttonRef.current.getBoundingClientRect());
    } else {
      setDropdownRect(null);
    }
  }, [open]);

  const addActivity = (name: string) => {
    const start = new Date(phaseStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const endStr = end > new Date(phaseEndDate) ? phaseEndDate : end.toISOString().slice(0, 10);
    onAdd(phaseId, name, phaseStartDate, endStr);
    setCustomName('');
    setOpen(false);
    onClose?.();
  };

  const dropdownContent =
    open && typeof document !== 'undefined' ? (
      createPortal(
        <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
          <div
            className="fixed inset-0 bg-black/20"
            style={{ pointerEvents: 'auto' }}
            onClick={() => {
              setOpen(false);
              onClose?.();
            }}
            aria-hidden="true"
          />
          <div
            className="fixed min-w-[200px] max-h-[70vh] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg"
            style={{
              pointerEvents: 'auto',
              ...(dropdownRect
                ? { left: dropdownRect.left, top: dropdownRect.bottom + 4 }
                : {}),
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            {templates.length > 0 && (
              <div className="border-b border-zinc-100 px-2 py-1">
                <div className="text-[10px] font-medium uppercase text-zinc-400">
                  From template
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {templates.map((t) => (
                    <button
                      key={t}
                      onClick={() => addActivity(t)}
                      className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="px-2 py-1">
              <div className="text-[10px] font-medium uppercase text-zinc-400">
                Custom
              </div>
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customName.trim()) {
                      addActivity(customName.trim());
                    }
                  }}
                  placeholder="Activity name..."
                  className="flex-1 rounded border border-zinc-200 px-2 py-0.5 text-xs placeholder:text-zinc-400"
                />
                <button
                  onClick={() => customName.trim() && addActivity(customName.trim())}
                  disabled={!customName.trim()}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
            {onAddPause && phaseType !== 'pause' && (
              <div className="border-t border-zinc-100 px-2 py-1">
                <button
                  onClick={() => {
                    onAddPause(phaseId);
                    setOpen(false);
                    onClose?.();
                  }}
                  className="w-full rounded px-2 py-1 text-left text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  + Add pause after {PHASE_LABELS[phaseType]}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center gap-1 rounded border border-dashed border-zinc-200 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-600"
        title="Add activity"
      >
        {compact ? (
          <span className="text-xs">+ Add activity</span>
        ) : (
          '+ Activity'
        )}
      </button>
      {dropdownContent}
    </div>
  );
}
