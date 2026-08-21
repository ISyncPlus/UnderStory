'use client';

import { useId, useState } from 'react';

import type { QueryMeta } from '@/lib/errors';

import { Icon } from './icon';

const KEYWORDS = new Set([
  'MATCH', 'OPTIONAL', 'WHERE', 'RETURN', 'WITH', 'UNWIND', 'ORDER', 'BY', 'LIMIT', 'SKIP',
  'AND', 'OR', 'NOT', 'IN', 'AS', 'DISTINCT', 'ASC', 'DESC', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'UNION', 'NULL', 'IS', 'CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'CALL', 'YIELD',
  'CONSTRAINT', 'INDEX', 'REQUIRE', 'FOR', 'IF', 'EXISTS', 'UNIQUE', 'TRUE', 'FALSE',
]);

const FUNCTIONS = new Set([
  'shortestPath', 'allShortestPaths', 'count', 'collect', 'head', 'tail', 'nodes',
  'relationships', 'length', 'size', 'min', 'max', 'sum', 'coalesce', 'toLower', 'toUpper',
  'reduce', 'labels', 'type', 'keys', 'properties',
]);

/** Renders Cypher with the three distinctions that actually help a reader: */
function highlight(cypher: string) {
  const tokens = cypher.split(/(\s+|[(),:{}\[\]|>.-])/);
  return tokens.map((token, index) => {
    if (token.startsWith('$')) {
      return (
        <span key={index} className="text-jumper">
          {token}
        </span>
      );
    }
    const upper = token.toUpperCase();
    if (KEYWORDS.has(upper) && token === upper) {
      return (
        <span key={index} className="font-semibold text-ink">
          {token}
        </span>
      );
    }
    if (FUNCTIONS.has(token)) {
      return (
        <span key={index} className="text-clear">
          {token}
        </span>
      );
    }
    if (/^'[^']*'$/.test(token)) {
      return (
        <span key={index} className="text-clear">
          {token}
        </span>
      );
    }
    return <span key={index}>{token}</span>;
  });
}

/** "Show the query." */
export function QueryDisclosure({ queries, label = 'Show the query' }: { queries: QueryMeta[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const usable = queries.filter(Boolean);
  if (usable.length === 0) return null;

  const totalMs = usable.reduce((sum, query) => sum + query.elapsedMs, 0);

  return (
    <div className="no-print border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-stock-sunk"
      >
        <span className="flex items-center gap-2">
          <Icon
            name="chevron"
            size={12}
            className={`text-ink-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <span className="stencil">{label}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="stencil text-ink-3">
            {usable.length === 1 ? '1 statement' : `${usable.length} statements`}
          </span>
          <span className="flex items-center gap-1 text-ink-3">
            <Icon name="clock" size={12} />
            <span className="datum text-[12px]">{totalMs} ms</span>
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="border-t border-rule-hair bg-stock-sunk">
          {usable.map((query, index) => (
            <div key={`${query.name}-${index}`} className="border-b border-rule-hair last:border-b-0 px-4 py-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="stencil-strong">{query.name}</span>
                <span className="datum text-[12px] text-ink-3">
                  {query.records} {query.records === 1 ? 'record' : 'records'} · {query.elapsedMs} ms
                </span>
              </div>
              <p className="mb-3 max-w-[56ch] text-datum text-ink-2">{query.purpose}</p>
              <pre className="datum overflow-x-auto whitespace-pre border border-rule bg-sheet p-3 text-[12px] leading-relaxed text-ink-2">
                <code>{highlight(query.cypher)}</code>
              </pre>
              {Object.keys(query.params).length > 0 ? (
                <div className="mt-3">
                  <div className="stencil mb-1.5">Bound parameters</div>
                  <pre className="datum overflow-x-auto border border-rule bg-sheet p-3 text-[12px] text-ink-2">
                    <code>{JSON.stringify(query.params, null, 2)}</code>
                  </pre>
                </div>
              ) : (
                <p className="mt-3 stencil text-ink-3">No parameters</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
