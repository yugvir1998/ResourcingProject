'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Venture } from '@/types';

interface KanbanColumnProps {
  id: string;
  title: string;
  ventures: Venture[];
  variant?: 'backlog' | 'active';
  renderCard: (venture: Venture) => React.ReactNode;
}

export function KanbanColumn({ id, title, ventures, variant = 'backlog', renderCard }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const baseStyles = 'min-w-[260px] rounded-xl border-2 p-3 transition-all duration-200';
  const backlogStyles = variant === 'backlog' ? 'border-slate-200/80 bg-slate-50/50' : 'border-amber-200/80 bg-amber-50/30';
  const isOverStyles = isOver ? 'border-amber-400/60 bg-amber-50/60 shadow-sm' : '';

  return (
    <div ref={setNodeRef} className={`${baseStyles} ${backlogStyles} ${isOverStyles}`}>
      <h3 className="mb-3 text-sm font-medium text-zinc-600">{title}</h3>
      <SortableContext items={ventures.map((v) => `card-${v.id}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {ventures.map((v) => renderCard(v))}
        </div>
      </SortableContext>
    </div>
  );
}
