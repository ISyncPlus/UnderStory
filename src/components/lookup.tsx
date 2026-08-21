'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Icon, type IconName } from './icon';

type Hit = {
  kind: 'application' | 'package' | 'advisory' | 'maintainer';
  label: string;
  id: string;
  detail: string;
};

const KIND_ICON: Record<Hit['kind'], IconName> = {
  application: 'application',
  package: 'package',
  advisory: 'advisory',
  maintainer: 'maintainer',
};

const KIND_LABEL: Record<Hit['kind'], string> = {
  application: 'Application',
  package: 'Package',
  advisory: 'Advisory',
  maintainer: 'Maintainer',
};

function hrefFor(hit: Hit): string {
  switch (hit.kind) {
    case 'application':
      return `/applications/${hit.id}`;
    case 'advisory':
      return `/advisories/${hit.id}`;
    case 'maintainer':
      return `/maintainers/${hit.id}`;
    case 'package': {
      const [ecosystem, ...rest] = hit.id.split(':');
      return `/packages/${ecosystem}/${rest.join(':')}`;
    }
  }
}

/** Directory lookup. */
export function Lookup() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<'idle' | 'searching' | 'ready' | 'failed'>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setState('idle');
      return;
    }

    setState('searching');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((response) => {
          if (!response.ok) throw new Error('search failed');
          return response.json() as Promise<{ hits: Hit[] }>;
        })
        .then((body) => {
          setHits(body.hits);
          setActive(0);
          setState('ready');
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setState('failed');
          setHits([]);
        });
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  const go = useCallback(
    (hit: Hit) => {
      setOpen(false);
      setTerm('');
      router.push(hrefFor(hit));
    },
    [router],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % hits.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
      const hit = hits[active];
      if (hit) {
        event.preventDefault();
        go(hit);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-[15rem] sm:max-w-xs">
      <div className="relative">
        <Icon
          name="search"
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={term}
          placeholder="Find anything"
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="field h-8 min-h-0 py-0 pl-8 pr-12 text-[12px]"
        />
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 bg-stock-sunk px-1.5 py-1 font-stencil text-[11px] font-semibold leading-none tracking-widest text-ink-2 sm:block">
          &#8984;K
        </kbd>
      </div>

      {open && term.trim().length >= 2 ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[22rem] overflow-y-auto border border-rule-strong bg-sheet"
          style={{ boxShadow: '0 10px 28px -12px color-mix(in oklch, var(--color-ink) 40%, transparent)' }}
        >
          {state === 'searching' ? (
            <p className="stencil px-3 py-3">Looking&#8230;</p>
          ) : state === 'failed' ? (
            <div className="px-3 py-3">
              <p className="stencil text-jumper">Lookup unavailable</p>
              <p className="mt-1 text-datum text-ink-2">
                The database did not answer. Everything else on this page is still readable.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="px-3 py-3">
              <p className="stencil">No match</p>
              <p className="mt-1 text-datum text-ink-2">
                Nothing in the graph matches &#8220;{term.trim()}&#8221;.
              </p>
            </div>
          ) : (
            <ul className="ruled">
              {hits.map((hit, index) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link
                    href={hrefFor(hit)}
                    role="option"
                    aria-selected={index === active}
                    onClick={() => {
                      setOpen(false);
                      setTerm('');
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={`flex items-center gap-2.5 px-3 py-2 no-underline ${
                      index === active ? 'bg-stock-sunk' : ''
                    }`}
                  >
                    <Icon name={KIND_ICON[hit.kind]} size={13} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-row text-ink">{hit.label}</span>
                      <span className="block truncate text-datum text-ink-3">{hit.detail}</span>
                    </span>
                    <span className="stencil shrink-0">{KIND_LABEL[hit.kind]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
