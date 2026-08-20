'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Estate' },
  { href: '/advisories', label: 'Faults' },
  { href: '/applications', label: 'Applications' },
  { href: '/maintainers', label: 'Maintainers' },
  { href: '/trace', label: 'Trace' },
] as const;

export function FrameIndex() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex items-center">
      <ul className="flex items-center">
        {LINKS.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative block border-r border-rule px-3 py-3 no-underline transition-colors first:border-l ${
                  active ? 'text-ink' : 'text-ink-3 hover:text-ink'
                }`}
              >
                <span className="stencil-strong" style={active ? undefined : { color: 'inherit' }}>
                  {link.label}
                </span>
                {active ? (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-jumper" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
