import 'server-only';

import type { Outcome } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import type { Ecosystem } from '../model';
import { PATH_DEPTH, ROUTE_PROJECTION, asEcosystem, asNumber, asString, mapRoute, type Route } from './shared';

export type TraceResult = {
  application: { slug: string; name: string; team: string } | null;
  package: { key: string; name: string; ecosystem: Ecosystem; role: string } | null;
  routes: Array<{
    target: { key: string; version: string; published: string };
    route: Route;
  }>;
};

/**
 * "Why is this here?"
 *
 * Given an application and a package anywhere beneath it, return the shortest
 * chain that explains the package's presence — one per reachable release, so a
 * reader can see that two different releases of the same package arrived by
 * two different routes. That last part is the answer to the question people
 * actually have, and it is the one a dependency *list* structurally cannot
 * give: a list knows the package is there, not how it got there.
 */
export function traceRoutes(slug: string, packageKey: string): Promise<Outcome<TraceResult>> {
  return read({
    name: 'Route trace',
    purpose: 'The shortest dependency chain from one application to each reachable release of one package.',
    cypher: `
      MATCH (application:Application { slug: $slug })
      MATCH (package:Package { key: $packageKey })
      OPTIONAL MATCH (package)<-[:VERSION_OF]-(release:PackageVersion)
      OPTIONAL MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(release))
      WITH application, package, release, route
      ORDER BY length(route) ASC, release.ordinal DESC
      RETURN application.slug AS slug,
             application.name AS applicationName,
             application.team AS team,
             package.key AS packageKey,
             package.name AS packageName,
             package.ecosystem AS ecosystem,
             package.role AS role,
             collect(CASE WHEN route IS NULL THEN null ELSE {
               target: { key: release.key, version: release.version, published: release.published },
               route: ${ROUTE_PROJECTION}
             } END) AS routes
    `,
    params: { slug, packageKey },
    map: (records) => {
      const record = records[0];
      if (!record) return { application: null, package: null, routes: [] };
      return {
        application: {
          slug: asString(record.get('slug')),
          name: asString(record.get('applicationName')),
          team: asString(record.get('team')),
        },
        package: {
          key: asString(record.get('packageKey')),
          name: asString(record.get('packageName')),
          ecosystem: asEcosystem(record.get('ecosystem')),
          role: asString(record.get('role')),
        },
        routes: (record.get('routes') as Array<Record<string, unknown> | null>)
          .filter((row): row is Record<string, unknown> => row !== null)
          .map((row) => {
            const target = (row.target ?? {}) as Record<string, unknown>;
            return {
              target: {
                key: asString(target.key),
                version: asString(target.version),
                published: asString(target.published),
              },
              route: mapRoute(row.route) ?? { depth: 0, hops: [], edges: [] },
            };
          }),
      };
    },
  });
}

export type AlternateRoutes = {
  total: number;
  routes: Route[];
};

/**
 * Every equally-short route to one release.
 *
 * `allShortestPaths` returns the full set of minimum-length paths, which is
 * how you find out that a dependency arrives through four different top-level
 * packages rather than one — and therefore that removing any single one of
 * them changes nothing.
 */
export function getAlternateRoutes(slug: string, versionKey: string, limit = 8): Promise<Outcome<AlternateRoutes>> {
  return read({
    name: 'Alternate routes',
    purpose: 'Every equally-short dependency chain between this application and this release — the reason removing one of them may change nothing.',
    cypher: `
      MATCH (application:Application { slug: $slug })
      MATCH (target:PackageVersion { key: $versionKey })
      MATCH route = allShortestPaths((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(target))
      WITH collect(${ROUTE_PROJECTION}) AS routes
      RETURN size(routes) AS total, routes[0..$limit] AS routes
    `,
    params: { slug, versionKey, limit },
    map: (records) => {
      const record = records[0];
      if (!record) return { total: 0, routes: [] };
      return {
        total: asNumber(record.get('total')),
        routes: (record.get('routes') as unknown[])
          .map(mapRoute)
          .filter((route): route is Route => route !== null),
      };
    },
  });
}

export type TraceablePackage = {
  key: string;
  name: string;
  ecosystem: Ecosystem;
  role: string;
  depth: number;
};

/** Packages reachable from one application, for the trace form's package picker. */
export function getTraceablePackages(slug: string, search: string, limit = 40): Promise<Outcome<TraceablePackage[]>> {
  return read({
    name: 'Reachable packages',
    purpose: 'Packages this application can reach, filtered by name, for choosing a trace target.',
    cypher: `
      MATCH (application:Application { slug: $slug })
      MATCH path = (application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(release:PackageVersion)
      MATCH (release)-[:VERSION_OF]->(package:Package)
      WHERE $search = '' OR toLower(package.name) CONTAINS $search
      WITH package, min(length(path)) AS depth
      RETURN package.key AS key,
             package.name AS name,
             package.ecosystem AS ecosystem,
             package.role AS role,
             depth
      ORDER BY depth ASC, package.name ASC
      LIMIT $limit
    `,
    params: { slug, search: search.toLowerCase(), limit },
    map: (records) =>
      records.map((record) => ({
        key: asString(record.get('key')),
        name: asString(record.get('name')),
        ecosystem: asEcosystem(record.get('ecosystem')),
        role: asString(record.get('role')),
        depth: asNumber(record.get('depth')),
      })),
  });
}
