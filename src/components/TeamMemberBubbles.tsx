'use client';

function getFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name || '?';
}

interface TeamMemberBubblesProps {
  members: { id: number; name: string }[];
  /** Size variant - compact for smaller cards */
  size?: 'default' | 'compact';
  className?: string;
}

/**
 * Displays team members as oval bubbles with first name.
 * First member gets a lead indicator dot.
 * Matches the venture card design: light background, dark text, lead dot.
 */
export function TeamMemberBubbles({ members, size = 'default', className = '' }: TeamMemberBubblesProps) {
  if (members.length === 0) return null;

  const isCompact = size === 'compact';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {members.map((member, idx) => (
        <span
          key={member.id}
          className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-2.5 py-1 font-medium text-zinc-900 ${
            isCompact ? 'text-[10px] px-2 py-0.5' : 'text-xs'
          }`}
          title={member.name}
        >
          <span className="uppercase">{getFirstName(member.name)}</span>
          {idx === 0 && <span className="h-1 w-1 shrink-0 rounded-full bg-black" aria-hidden />}
        </span>
      ))}
    </div>
  );
}
