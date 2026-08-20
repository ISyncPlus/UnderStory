'use client';

import { useEffect, useState } from 'react';

import { Icon } from './icon';
import { applyThemeTransition, type Print } from '@/lib/theme-transition';

/**
 * Stock or negative.
 *
 * The two prints are the drawing's own pair — pale drafting stock under office
 * light, and the blue negative that comes back from the reprographer. The
 * choice persists per browser; the inline script in the root layout applies it
 * before first paint so the page never flashes the wrong print.
 */
export function PrintToggle() {
  const [print, setPrint] = useState<Print>('stock');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setPrint(current === 'negative' ? 'negative' : 'stock');
  }, []);

  function apply(next: Print, targetElement?: HTMLElement) {
    applyThemeTransition(() => {
      setPrint(next);
      document.documentElement.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem('understory.print', next);
      } catch {
        // A browser that refuses storage still gets the change for this session.
      }
    }, targetElement);
  }

  return (
    <button
      type="button"
      onClick={(e) => apply(print === 'stock' ? 'negative' : 'stock', e.currentTarget)}
      className="control h-8 min-h-0 px-2"
      aria-label={print === 'stock' ? 'Switch to the negative print' : 'Switch to drafting stock'}
      title={print === 'stock' ? 'Negative print' : 'Drafting stock'}
    >
      <Icon name="print" size={13} />
      <span className="hidden sm:inline">{print === 'stock' ? 'Stock' : 'Negative'}</span>
    </button>
  );
}
