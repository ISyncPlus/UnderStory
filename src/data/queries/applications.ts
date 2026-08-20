import 'server-only';

import type { Outcome } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import { RECIPROCAL_CATEGORIES, type Ecosystem, type LicenseCategory, type Severity } from '../model';
import {
  PATH_DEPTH,
  REACH_DEPTH,
  ROUTE_PROJECTION,
  asEcosystem,
  asNumber,
  asSeverity,
  asString,
  mapRoute,
  type Route,
} from './shared';

export type ApplicationProfile = {
  slug: string;
  name: string;
  team: string;
  tier: string;
  runtime: string;
  purpose: string;
  firstShipped: string;
  depthProfile: Array<{ depth: number; newPackages: number }>;
  totalReach: number;
};

/**
 * An application's profile, including how its dependencies stack up by depth.
 *
 * The depth profile is six bounded expansions from a single node rather than
 * one unbounded walk that measures path lengths. Each `count(DISTINCT …)` is a
 * set question — "how many releases are within N hops?" — so an engine with
 * pruning expansion answers it without materialising a single path, and the
 * differences between the cumulative counts give the number of packages that
 * first appear at each depth.
 */
export function getApplicationProfile(slug: string): Promise<Outcome<ApplicationProfile | null>> {
  return read({
    name: 'Application profile',
    purpose: 'One application, with the number of package releases that first become reachable at each depth from 1 to 6.',
    cypher: `
      MATCH (application:Application { slug: $slug })
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..1]->(a:PackageVersion)
      WITH application, count(DISTINCT a) AS d1
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..2]->(b:PackageVersion)
      WITH application, d1, count(DISTINCT b) AS d2
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..3]->(c:PackageVersion)
      WITH application, d1, d2, count(DISTINCT c) AS d3
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..4]->(d:PackageVersion)
      WITH application, d1, d2, d3, count(DISTINCT d) AS d4
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..5]->(e:PackageVersion)
      WITH application, d1, d2, d3, d4, count(DISTINCT e) AS d5
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..6]->(f:PackageVersion)
      WITH application, d1, d2, d3, d4, d5, count(DISTINCT f) AS d6
      RETURN application.slug AS slug,
             application.name AS name,
             application.team AS team,
             application.tier AS tier,
             application.runtime AS runtime,
             application.purpose AS purpose,
             application.firstShipped AS firstShipped,
             [d1, d2 - d1, d3 - d2, d4 - d3, d5 - d4, d6 - d5] AS newAtDepth,
             d6 AS totalReach
    `,
    params: { slug },
    map: (records) => {
      const record = records[0];
      if (!record) return null;
      const newAtDepth = (record.get('newAtDepth') as unknown[]).map((value) => asNumber(value));
      return {
        slug: asString(record.get('slug')),
        name: asString(record.get('name')),
        team: asString(record.get('team')),
        tier: asString(record.get('tier')),
        runtime: asString(record.get('runtime')),
        purpose: asString(record.get('purpose')),
        firstShipped: asString(record.get('firstShipped')),
        depthProfile: newAtDepth.map((newPackages, index) => ({ depth: index + 1, newPackages })),
        totalReach: asNumber(record.get('totalReach')),
      };
    },
  });
}

export type DirectDependency = {
  key: string;
  name: string;
  version: string;
  ecosystem: Ecosystem;
  scope: string;
  range: string;
  role: string;
  license: string | null;
  licenseCategory: LicenseCategory | null;
  advisoryCount: number;
  worstSeverity: Severity | null;
};

/** What the application actually declares, with the advisories sitting directly on those releases. */
export function getDirectDependencies(slug: string): Promise<Outcome<DirectDependency[]>> {
  return read({
    name: 'Declared dependencies',
    purpose: 'The releases this application depends on directly, with the range it declared and any advisory on that exact release.',
    cypher: `
      MATCH (:Application { slug: $slug })-[edge:DEPENDS_ON]->(version:PackageVersion)
      MATCH (version)-[:VERSION_OF]->(package:Package)
      OPTIONAL MATCH (version)-[:LICENSED_UNDER]->(license:License)
      OPTIONAL MATCH (advisory:Advisory)-[:AFFECTS]->(version)
      WITH version, package, edge, license, collect(DISTINCT advisory) AS advisories
      RETURN version.key AS key,
             version.name AS name,
             version.version AS version,
             version.ecosystem AS ecosystem,
             edge.scope AS scope,
             edge.range AS range,
             package.role AS role,
             license.spdxId AS license,
             license.category AS licenseCategory,
             size(advisories) AS advisoryCount,
             [item IN advisories | item.severity] AS severities
      ORDER BY size(advisories) DESC, version.name ASC
    `,
    params: { slug },
    map: (records) =>
      records.map((record) => {
        const severities = (record.get('severities') as unknown[]).map(asSeverity);
        const order: Severity[] = ['critical', 'high', 'medium', 'low'];
        const worstSeverity = order.find((severity) => severities.includes(severity)) ?? null;
        const category = record.get('licenseCategory');
        return {
          key: asString(record.get('key')),
          name: asString(record.get('name')),
          version: asString(record.get('version')),
          ecosystem: asEcosystem(record.get('ecosystem')),
          scope: asString(record.get('scope'), 'runtime'),
          range: asString(record.get('range')),
          role: asString(record.get('role')),
          license: record.get('license') === null ? null : asString(record.get('license')),
          licenseCategory: category === null ? null : (asString(category) as LicenseCategory),
          advisoryCount: asNumber(record.get('advisoryCount')),
          worstSeverity,
        };
      }),
  });
}

export type ApplicationAdvisory = {
  id: string;
  title: string;
  severity: Severity;
  score: number;
  packageName: string;
  ecosystem: Ecosystem;
  fixedIn: string | null;
  route: Route | null;
  targetVersion: string;
};

/** Every advisory this application can reach, with the shortest route to each. */
export function getApplicationAdvisories(slug: string): Promise<Outcome<ApplicationAdvisory[]>> {
  return read({
    name: 'Reachable advisories',
    purpose: 'Every advisory reachable from this application, each with the shortest dependency path that gets there.',
    cypher: `
      MATCH (application:Application { slug: $slug })
      MATCH (advisory:Advisory)-[affects:AFFECTS]->(vulnerable:PackageVersion)
      MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(vulnerable))
      WITH advisory, affects, vulnerable, route
      ORDER BY length(route) ASC, vulnerable.ordinal DESC
      WITH advisory,
           head(collect({
             route: ${ROUTE_PROJECTION},
             packageName: vulnerable.name,
             ecosystem: vulnerable.ecosystem,
             version: vulnerable.version,
             fixedIn: affects.fixedIn
           })) AS best
      RETURN advisory.id AS id,
             advisory.title AS title,
             advisory.severity AS severity,
             advisory.score AS score,
             best
      ORDER BY advisory.score DESC, advisory.id ASC
    `,
    params: { slug },
    map: (records) =>
      records.map((record) => {
        const best = (record.get('best') ?? {}) as Record<string, unknown>;
        return {
          id: asString(record.get('id')),
          title: asString(record.get('title')),
          severity: asSeverity(record.get('severity')),
          score: asNumber(record.get('score')),
          packageName: asString(best.packageName),
          ecosystem: asEcosystem(best.ecosystem),
          fixedIn: best.fixedIn == null ? null : asString(best.fixedIn),
          route: mapRoute(best.route),
          targetVersion: asString(best.version),
        };
      }),
  });
}

export type LicenceExposure = {
  spdxId: string;
  licenseName: string;
  category: LicenseCategory;
  note: string;
  packagesReached: number;
  nearest: { route: Route | null; packageName: string; version: string } | null;
};

/**
 * Reciprocal-licence exposure: the question a table cannot answer well.
 *
 * An application's own licence is a single field. Whether it is *compatible*
 * with what it ships is a property of everything beneath it — and the useful
 * answer is not "you have an AGPL dependency" but "here is the four-hop chain
 * that introduced it, and here is the hop you would have to change".
 */
export function getLicenceExposure(slug: string): Promise<Outcome<LicenceExposure[]>> {
  return read({
    name: 'Reciprocal licence exposure',
    purpose: 'Copyleft licences reachable from this application, with the shortest dependency chain that introduces each one.',
    cypher: `
      MATCH (application:Application { slug: $slug })
      MATCH (license:License) WHERE license.category IN $categories
      MATCH (version:PackageVersion)-[:LICENSED_UNDER]->(license)
      MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(version))
      WITH license, version, route
      ORDER BY length(route) ASC, version.name ASC
      WITH license,
           count(DISTINCT version.name) AS packagesReached,
           head(collect({
             route: ${ROUTE_PROJECTION},
             packageName: version.name,
             version: version.version
           })) AS nearest
      RETURN license.spdxId AS spdxId,
             license.name AS licenseName,
             license.category AS category,
             license.note AS note,
             packagesReached,
             nearest
      ORDER BY
        CASE license.category
          WHEN 'network-copyleft' THEN 0
          WHEN 'strong-copyleft' THEN 1
          ELSE 2
        END ASC,
        packagesReached DESC
    `,
    params: { slug, categories: [...RECIPROCAL_CATEGORIES] },
    map: (records) =>
      records.map((record) => {
        const nearest = record.get('nearest') as Record<string, unknown> | null;
        return {
          spdxId: asString(record.get('spdxId')),
          licenseName: asString(record.get('licenseName')),
          category: asString(record.get('category')) as LicenceExposure['category'],
          note: asString(record.get('note')),
          packagesReached: asNumber(record.get('packagesReached')),
          nearest: nearest
            ? {
                route: mapRoute(nearest.route),
                packageName: asString(nearest.packageName),
                version: asString(nearest.version),
              }
            : null,
        };
      }),
  });
}

export type ApplicationListRow = {
  slug: string;
  name: string;
  team: string;
  tier: string;
  runtime: string;
  purpose: string;
  directDependencies: number;
  reachablePackages: number;
};

export function listApplications(): Promise<Outcome<ApplicationListRow[]>> {
  return read({
    name: 'Applications',
    purpose: 'Every application in the estate with its declared and transitive dependency counts.',
    cypher: `
      MATCH (application:Application)
      OPTIONAL MATCH (application)-[direct:DEPENDS_ON]->(:PackageVersion)
      WITH application, count(direct) AS directDependencies
      OPTIONAL MATCH (application)-[:DEPENDS_ON*1..${REACH_DEPTH}]->(reached:PackageVersion)
      WITH DISTINCT application, directDependencies, reached
      RETURN application.slug AS slug,
             application.name AS name,
             application.team AS team,
             application.tier AS tier,
             application.runtime AS runtime,
             application.purpose AS purpose,
             directDependencies,
             count(DISTINCT reached.name) AS reachablePackages
      ORDER BY application.team ASC, application.name ASC
    `,
    params: {},
    map: (records) =>
      records.map((record) => ({
        slug: asString(record.get('slug')),
        name: asString(record.get('name')),
        team: asString(record.get('team')),
        tier: asString(record.get('tier')),
        runtime: asString(record.get('runtime')),
        purpose: asString(record.get('purpose')),
        directDependencies: asNumber(record.get('directDependencies')),
        reachablePackages: asNumber(record.get('reachablePackages')),
      })),
  });
}
