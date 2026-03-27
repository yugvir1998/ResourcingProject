'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/Toast';

const MAX_UNDO = 5;

export type UndoEntryInput = {
  label: string;
  undo: () => Promise<void>;
};

type UndoEntry = UndoEntryInput & { id: number };

type UndoContextValue = {
  pushUndo: (entry: UndoEntryInput) => void;
  undoLast: () => Promise<void>;
  canUndo: boolean;
  depth: number;
  peekLabel: string | null;
};

const UndoContext = createContext<UndoContextValue | null>(null);

let idSeq = 0;

export function UndoProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<UndoEntry[]>([]);
  const [tick, setTick] = useState(0);
  const toast = useToast();
  const runningRef = useRef(false);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const pushUndo = useCallback(
    (entry: UndoEntryInput) => {
      const id = ++idSeq;
      stackRef.current = [...stackRef.current, { id, label: entry.label, undo: entry.undo }].slice(
        -MAX_UNDO
      );
      bump();
    },
    [bump]
  );

  const undoLast = useCallback(async () => {
    if (runningRef.current) return;
    const stack = stackRef.current;
    if (stack.length === 0) return;
    const entry = stack[stack.length - 1];
    stackRef.current = stack.slice(0, -1);
    bump();
    runningRef.current = true;
    try {
      await entry.undo();
      toast.show('Undone');
    } catch {
      toast.show('Could not undo');
    } finally {
      runningRef.current = false;
    }
  }, [bump, toast]);

  const value = useMemo<UndoContextValue>(() => {
    const s = stackRef.current;
    return {
      pushUndo,
      undoLast,
      canUndo: s.length > 0,
      depth: s.length,
      peekLabel: s.length > 0 ? s[s.length - 1].label : null,
    };
  }, [tick, pushUndo, undoLast]);

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    throw new Error('useUndo must be used within UndoProvider');
  }
  return ctx;
}

/** No-op push when outside Command Center (e.g. shared components). */
export function useUndoOptional(): UndoContextValue | null {
  return useContext(UndoContext);
}
