'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV_ITEMS = [
  { href: '/', label: 'Command Center', icon: 'layout' },
  { href: '/team', label: 'Team', icon: 'users' },
] as const;

function NavIcon({ type }: { type: 'layout' | 'users' }) {
  if (type === 'layout') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <div className="flex items-center gap-3">
    <nav className="flex gap-1">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 ${
              isActive ? 'font-semibold text-zinc-900' : 'text-zinc-600'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <NavIcon type={icon} />
            {label}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-zinc-900" />
            )}
          </Link>
        );
      })}
    </nav>
    {status === 'authenticated' && session?.user && (
      <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
        <span className="hidden max-w-[10rem] truncate text-xs text-zinc-500 sm:inline" title={session.user.email ?? undefined}>
          {session.user.email ?? session.user.name}
        </span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          Sign out
        </button>
      </div>
    )}
    </div>
  );
}
