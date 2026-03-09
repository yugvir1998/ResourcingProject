'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Battlefield' },
  { href: '/exploration', label: 'Venture Tracker' },
  { href: '/timeline', label: 'Active Ventures' },
  { href: '/team', label: 'Team' },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium transition hover:text-zinc-900 ${
              isActive ? 'font-semibold text-zinc-900' : 'text-zinc-600'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
