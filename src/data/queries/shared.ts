import type { Record as Neo4jRecord } from 'neo4j-driver';

import type { DependencyScope, Ecosystem, Severity } from '../model';

/**
 * Traversal bounds.
 *
 * Two different numbers, for two different shapes of query:
 *
 * - `PATH_DEPTH` (8) bounds `shortestPath`, which is a breadth-first search
 *   with both endpoints bound. Its cost is a function of the graph, not of the
 *   number of paths, so it can afford the deeper bound.
 * - `REACH_DEPTH` (6) bounds set-shaped traversals — "everything this
 *   application can see". Those are the ones that would enumerate paths on a
 *   naive planner, so they get the tighter bound and are always written with
 *   `DISTINCT` so an engine that supports pruning expansion can use it.
 *
 * The deepest shortest path in the seeded graph is 6 hops, so neither bound
 * truncates a real answer; they exist to keep a pathological query from
 * reaching a 0.5 vCPU instance in the first place.
 *
 * Cypher does not accept a parameter for a variable-length bound, so these are
 * interpolated into the query text at module load. They are integers from this
 * file — never a value that came from a request.
 */
export const PATH_DEPTH = 8;
export const REACH_DEPTH = 6;

export type RouteNode = {
  key: string;
  name: string;
  version: string;
  ecosystem: Ecosystem;
};

export type RouteEdge = {
  scope: DependencyScope;
  range: string;
  direct: boolean;
};

/** One explained path: the chain of package versions between an application and something it reaches. */
export type Route = {
  depth: number;
  hops: RouteNode[];
  edges: RouteEdge[];
};

/**
 * The Cypher fragment that turns a bound path into a plain list of hops.
 *
 * Kept in one place so every route in the application has an identical shape,
 * and so the mapping below only has to be correct once.
 */
export const ROUTE_PROJECTION = `{
      depth: length(route),
      hops: [hop IN tail(nodes(route)) | {
        key: hop.key, name: hop.name, version: hop.version, ecosystem: hop.ecosystem
      }],
      edges: [edge IN relationships(route) | {
        scope: coalesce(edge.scope, 'runtime'),
        range: coalesce(edge.range, ''),
        direct: coalesce(edge.direct, false)
      }]
    }`;

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  // The driver is configured with `disableLosslessIntegers`, but a value that
  // slipped through as an Integer still has a `toNumber`.
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const converted = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(converted) ? converted : fallback;
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asSeverity(value: unknown): Severity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'low';
}

export function asEcosystem(value: unknown): Ecosystem {
  return value === 'pypi' ? 'pypi' : 'npm';
}

export function asScope(value: unknown): DependencyScope {
  return value === 'dev' || value === 'optional' ? value : 'runtime';
}

export function mapRoute(value: unknown): Route | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { depth?: unknown; hops?: unknown; edges?: unknown };
  const hops = Array.isArray(raw.hops) ? raw.hops : [];
  const edges = Array.isArray(raw.edges) ? raw.edges : [];
  return {
    depth: asNumber(raw.depth),
    hops: hops.map((hop) => {
      const node = (hop ?? {}) as Record<string, unknown>;
      return {
        key: asString(node.key),
        name: asString(node.name),
        version: asString(node.version),
        ecosystem: asEcosystem(node.ecosystem),
      };
    }),
    edges: edges.map((edge) => {
      const link = (edge ?? {}) as Record<string, unknown>;
      return {
        scope: asScope(link.scope),
        range: asString(link.range),
        direct: asBoolean(link.direct),
      };
    }),
  };
}

export function field(record: Neo4jRecord, key: string): unknown {
  return record.has(key) ? record.get(key) : undefined;
}
