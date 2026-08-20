'use client';

import { useEffect, useState } from 'react';

type Probe =
  | { state: 'checking' }
  | { state: 'up'; latencyMs: number }
  | { state: 'down'; title: string };

/**
 * The line lamp.
 *
 * Reports whether the exchange is answering, and how quickly. It probes once
 * on mount rather than polling: a burstable free-tier instance does not need a
 * heartbeat every few seconds, and a status light that generates traffic is
 * part of the problem it is reporting on.
 */
export function LineLamp() {
  const [probe, setProbe] = useState<Probe>({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { status?: string; latencyMs?: number; failure?: { title?: string } }) => {
        if (cancelled) return;
        if (body.status === 'ok') {
          setProbe({ state: 'up', latencyMs: Math.round(body.latencyMs ?? 0) });
        } else {
          setProbe({ state: 'down', title: body.failure?.title ?? 'Not answering' });
        }
      })
      .catch(() => {
        if (!cancelled) setProbe({ state: 'down', title: 'Not answering' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const tone =
    probe.state === 'up' ? 'text-clear' : probe.state === 'down' ? 'text-jumper' : 'text-ink-3';

  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap ${tone}`}
      title={probe.state === 'down' ? probe.title : undefined}
    >
      <span
        aria-hidden="true"
        className={`block h-[7px] w-[7px] shrink-0 border ${
          probe.state === 'checking' ? 'border-ink-3' : 'border-current'
        }`}
        style={probe.state === 'up' || probe.state === 'down' ? { backgroundColor: 'currentColor' } : undefined}
      />
      <span className="stencil hidden whitespace-nowrap text-current sm:inline">
        {probe.state === 'checking' ? 'Probing' : probe.state === 'up' ? `Line up · ${probe.latencyMs} ms` : 'Line down'}
      </span>
      <span className="sr-only">
        {probe.state === 'checking'
          ? 'Checking the database connection'
          : probe.state === 'up'
            ? `Database reachable, ${probe.latencyMs} milliseconds`
            : `Database unreachable: ${probe.title}`}
      </span>
    </span>
  );
}
