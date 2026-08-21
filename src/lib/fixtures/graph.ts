import { buildGraph, type BuiltGraph } from '@/data/build-graph';
import type { DependencyEdge, PackageVersion } from '@/data/model';
import type { Route, RouteEdge, RouteNode } from '@/data/queries/shared';

/** In-memory graph fixture. */
export class FixtureGraph {
  readonly data: BuiltGraph;

  readonly appBySlug: Map<string, BuiltGraph['applications'][number]>;
  readonly packageByKey: Map<string, BuiltGraph['packages'][number]>;
  readonly versionByKey: Map<string, PackageVersion>;
  readonly versionsByPackage: Map<string, PackageVersion[]>;
  readonly maintainerByHandle: Map<string, BuiltGraph['maintainers'][number]>;
  readonly maintainersByPackage: Map<string, string[]>;
  readonly packagesByMaintainer: Map<string, string[]>;
  readonly advisoryById: Map<string, BuiltGraph['advisories'][number]>;
  readonly affectedByAdvisory: Map<string, string[]>;
  readonly advisoriesByVersion: Map<string, string[]>;
  readonly licenceByVersion: Map<string, string>;
  readonly licenceById: Map<string, BuiltGraph['licenses'][number]>;
  readonly outgoing: Map<string, DependencyEdge[]>;
  readonly incoming: Map<string, DependencyEdge[]>;
  readonly appEdges: Map<string, DependencyEdge[]>;

  private readonly reachCache = new Map<string, Map<string, number>>();

  constructor() {
    this.data = buildGraph();

    this.appBySlug = new Map(this.data.applications.map((item) => [item.slug, item]));
    this.packageByKey = new Map(this.data.packages.map((item) => [item.key, item]));
    this.versionByKey = new Map(this.data.versions.map((item) => [item.key, item]));
    this.maintainerByHandle = new Map(this.data.maintainers.map((item) => [item.handle, item]));
    this.advisoryById = new Map(this.data.advisories.map((item) => [item.id, item]));
    this.licenceById = new Map(this.data.licenses.map((item) => [item.spdxId, item]));

    this.versionsByPackage = new Map();
    for (const version of this.data.versions) {
      const key = `${version.ecosystem}:${version.name}`;
      const list = this.versionsByPackage.get(key) ?? [];
      list.push(version);
      this.versionsByPackage.set(key, list);
    }
    for (const list of this.versionsByPackage.values()) list.sort((a, b) => a.ordinal - b.ordinal);

    this.maintainersByPackage = new Map();
    this.packagesByMaintainer = new Map();
    for (const edge of this.data.maintenance) {
      const owners = this.maintainersByPackage.get(edge.packageKey) ?? [];
      owners.push(edge.handle);
      this.maintainersByPackage.set(edge.packageKey, owners);
      const owned = this.packagesByMaintainer.get(edge.handle) ?? [];
      owned.push(edge.packageKey);
      this.packagesByMaintainer.set(edge.handle, owned);
    }

    this.affectedByAdvisory = new Map();
    this.advisoriesByVersion = new Map();
    for (const edge of this.data.affects) {
      const versions = this.affectedByAdvisory.get(edge.advisoryId) ?? [];
      versions.push(edge.versionKey);
      this.affectedByAdvisory.set(edge.advisoryId, versions);
      const advisories = this.advisoriesByVersion.get(edge.versionKey) ?? [];
      advisories.push(edge.advisoryId);
      this.advisoriesByVersion.set(edge.versionKey, advisories);
    }

    this.licenceByVersion = new Map(this.data.licensing.map((edge) => [edge.versionKey, edge.spdxId]));

    this.outgoing = new Map();
    this.incoming = new Map();
    for (const edge of this.data.versionDependencies) {
      const from = this.outgoing.get(edge.from) ?? [];
      from.push(edge);
      this.outgoing.set(edge.from, from);
      const into = this.incoming.get(edge.to) ?? [];
      into.push(edge);
      this.incoming.set(edge.to, into);
    }

    this.appEdges = new Map();
    for (const edge of this.data.applicationDependencies) {
      const list = this.appEdges.get(edge.from) ?? [];
      list.push(edge);
      this.appEdges.set(edge.from, list);
    }
  }

  /** version key -> shortest depth from the application, bounded. */
  reach(slug: string, maxDepth: number): Map<string, number> {
    const cacheKey = `${slug}:${maxDepth}`;
    const cached = this.reachCache.get(cacheKey);
    if (cached) return cached;

    const depths = new Map<string, number>();
    let frontier = [...new Set((this.appEdges.get(slug) ?? []).map((edge) => edge.to))];
    for (const key of frontier) depths.set(key, 1);
    let depth = 1;

    while (frontier.length > 0 && depth < maxDepth) {
      const next: string[] = [];
      for (const key of frontier) {
        for (const edge of this.outgoing.get(key) ?? []) {
          if (!depths.has(edge.to)) {
            depths.set(edge.to, depth + 1);
            next.push(edge.to);
          }
        }
      }
      frontier = next;
      depth += 1;
    }

    this.reachCache.set(cacheKey, depths);
    return depths;
  }

  /** The shortest route from an application to one release, or null. */
  shortestRoute(slug: string, versionKey: string, maxDepth: number): Route | null {
    const start = this.appEdges.get(slug) ?? [];
    if (start.length === 0) return null;

    const parent = new Map<string, DependencyEdge>();
    const seen = new Set<string>();
    let frontier: string[] = [];

    for (const edge of start) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      parent.set(edge.to, edge);
      frontier.push(edge.to);
    }

    let depth = 1;
    while (frontier.length > 0 && depth <= maxDepth) {
      if (seen.has(versionKey)) break;
      const next: string[] = [];
      for (const key of frontier) {
        for (const edge of this.outgoing.get(key) ?? []) {
          if (seen.has(edge.to)) continue;
          seen.add(edge.to);
          parent.set(edge.to, edge);
          next.push(edge.to);
        }
      }
      frontier = next;
      depth += 1;
    }

    if (!seen.has(versionKey)) return null;
    return this.buildRoute(parent, versionKey, slug);
  }

  /** Every shortest route of the minimum length, capped. */
  allShortestRoutes(slug: string, versionKey: string, maxDepth: number, cap: number): Route[] {
    const best = this.shortestRoute(slug, versionKey, maxDepth);
    if (!best) return [];
    const target = best.depth;

    const routes: Route[] = [];
    const walk = (node: string, trail: DependencyEdge[]) => {
      if (routes.length >= cap * 4) return;
      if (trail.length > target) return;
      const appEdge = (this.appEdges.get(slug) ?? []).find((edge) => edge.to === node);
      if (appEdge && trail.length + 1 === target) {
        routes.push(this.routeFromEdges([appEdge, ...trail]));
        return;
      }
      for (const edge of this.incoming.get(node) ?? []) {
        walk(edge.from, [edge, ...trail]);
      }
    };
    walk(versionKey, []);
    return routes.slice(0, cap);
  }

  private buildRoute(parent: Map<string, DependencyEdge>, target: string, slug: string): Route {
    const edges: DependencyEdge[] = [];
    let cursor: string | undefined = target;
    while (cursor) {
      const edge: DependencyEdge | undefined = parent.get(cursor);
      if (!edge) break;
      edges.unshift(edge);
      cursor = edge.from === slug ? undefined : edge.from;
    }
    return this.routeFromEdges(edges);
  }

  private routeFromEdges(edges: DependencyEdge[]): Route {
    const hops: RouteNode[] = [];
    const routeEdges: RouteEdge[] = [];
    for (const edge of edges) {
      const version = this.versionByKey.get(edge.to);
      if (!version) continue;
      hops.push({
        key: version.key,
        name: version.name,
        version: version.version,
        ecosystem: version.ecosystem,
      });
      routeEdges.push({
        scope: edge.scope,
        range: edge.range,
        direct: this.appBySlug.has(edge.from),
      });
    }
    return { depth: hops.length, hops, edges: routeEdges };
  }

  packageOf(versionKey: string): string {
    const version = this.versionByKey.get(versionKey);
    return version ? `${version.ecosystem}:${version.name}` : '';
  }
}

let singleton: FixtureGraph | null = null;

export function fixtureGraph(): FixtureGraph {
  if (!singleton) singleton = new FixtureGraph();
  return singleton;
}
