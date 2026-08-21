import 'server-only';

import type { Outcome, QueryMeta } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import type { Ecosystem, Severity } from '../model';
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

export type AdvisorySummary = {
  id: string;
  title: string;
  severity: Severity;
  score: number;
  weakness: string;
  summary: string;
  published: string;
  packageName: string;
  ecosystem: Ecosystem;
  affectedReleases: number;
  fixedIn: string | null;
  applicationsReached: number;
};

/** Advisory metadata and the size of the affected release range. No traversal. */
function listAdvisoryRecords(severities: string[], search: string) {
  return read({
    name: 'Advisory catalogue',
    purpose: 'Every advisory with its affected package, the size of its affected release range, and the release that fixes it.',
    cypher: `
      MATCH (advisory:Advisory)-[affects:AFFECTS]->(vulnerable:PackageVersion)
      WHERE ($severities = [] OR advisory.severity IN $severities)
        AND ($search = ''
             OR toLower(advisory.id) CONTAINS $search
             OR toLower(advisory.title) CONTAINS $search
             OR toLower(vulnerable.name) CONTAINS $search)
      WITH advisory,
           head(collect(vulnerable.name)) AS packageName,
           head(collect(vulnerable.ecosystem)) AS ecosystem,
           head(collect(affects.fixedIn)) AS fixedIn,
           count(vulnerable) AS affectedReleases
      RETURN advisory.id AS id,
             advisory.title AS title,
             advisory.severity AS severity,
             advisory.score AS score,
             advisory.weakness AS weakness,
             advisory.summary AS summary,
             advisory.published AS published,
             packageName,
             ecosystem,
             fixedIn,
             affectedReleases
      ORDER BY advisory.score DESC, advisory.id ASC
    `,
    params: { severities, search: search.toLowerCase() },
    map: (records) =>
      records.map((record) => ({
        id: asString(record.get('id')),
        title: asString(record.get('title')),
        severity: asSeverity(record.get('severity')),
        score: asNumber(record.get('score')),
        weakness: asString(record.get('weakness')),
        summary: asString(record.get('summary')),
        published: asString(record.get('published')),
        packageName: asString(record.get('packageName')),
        ecosystem: asEcosystem(record.get('ecosystem')),
        fixedIn: record.get('fixedIn') === null ? null : asString(record.get('fixedIn')),
        affectedReleases: asNumber(record.get('affectedReleases')),
      })),
  });
}

/** How many applications reach each advisory. */
function advisoryReachCounts() {
  return read({
    name: 'Advisory reach counts',
    purpose: 'For every advisory, the number of distinct applications with a dependency path to an affected release.',
    cypher: `
      MATCH (advisory:Advisory)-[:AFFECTS]->(vulnerable:PackageVersion)
      MATCH (application:Application)-[:DEPENDS_ON*1..${REACH_DEPTH}]->(vulnerable)
      WITH DISTINCT advisory, application
      RETURN advisory.id AS id, count(application) AS applicationsReached
      ORDER BY applicationsReached DESC, id ASC
    `,
    params: {},
    map: (records) =>
      records.map((record) => ({
        id: asString(record.get('id')),
        applicationsReached: asNumber(record.get('applicationsReached')),
      })),
  });
}

export async function listAdvisories(options: {
  severities?: readonly string[];
  search?: string;
} = {}): Promise<Outcome<AdvisorySummary[]> & { queries?: QueryMeta[] }> {
  const [catalogue, reach] = await Promise.all([
    listAdvisoryRecords([...(options.severities ?? [])], options.search ?? ''),
    advisoryReachCounts(),
  ]);

  if (!catalogue.ok) return catalogue;
  if (!reach.ok) return reach;

  const reachById = new Map(reach.data.map((row) => [row.id, row.applicationsReached]));

  return {
    ok: true,
    data: catalogue.data.map((advisory) => ({
      ...advisory,
      applicationsReached: reachById.get(advisory.id) ?? 0,
    })),
    meta: catalogue.meta,
    queries: [catalogue.meta, reach.meta],
  };
}

export type AffectedRelease = {
  key: string;
  version: string;
  published: string;
};

export type AdvisoryDetail = {
  id: string;
  title: string;
  severity: Severity;
  score: number;
  weakness: string;
  summary: string;
  published: string;
  synthetic: boolean;
  packageName: string;
  packageKey: string;
  ecosystem: Ecosystem;
  packageRole: string;
  weeklyDownloads: number;
  introducedIn: string | null;
  fixedIn: string | null;
  affected: AffectedRelease[];
  maintainers: Array<{ handle: string; name: string; twoFactorEnabled: boolean }>;
};

export function getAdvisory(id: string): Promise<Outcome<AdvisoryDetail | null>> {
  return read({
    name: 'Advisory record',
    purpose: 'The advisory itself, the package it affects, exactly which releases fall inside the range, and who maintains that package.',
    cypher: `
      MATCH (advisory:Advisory { id: $id })-[affects:AFFECTS]->(vulnerable:PackageVersion)
      MATCH (vulnerable)-[:VERSION_OF]->(package:Package)
      OPTIONAL MATCH (package)-[:MAINTAINED_BY]->(maintainer:Maintainer)
      WITH advisory, package,
           head(collect(affects.introducedIn)) AS introducedIn,
           head(collect(affects.fixedIn)) AS fixedIn,
           collect(DISTINCT {
             key: vulnerable.key, version: vulnerable.version,
             published: vulnerable.published, ordinal: vulnerable.ordinal
           }) AS affected,
           collect(DISTINCT CASE WHEN maintainer IS NULL THEN null ELSE {
             handle: maintainer.handle, name: maintainer.name,
             twoFactorEnabled: maintainer.twoFactorEnabled
           } END) AS maintainers
      RETURN advisory.id AS id,
             advisory.title AS title,
             advisory.severity AS severity,
             advisory.score AS score,
             advisory.weakness AS weakness,
             advisory.summary AS summary,
             advisory.published AS published,
             coalesce(advisory.synthetic, true) AS synthetic,
             package.name AS packageName,
             package.key AS packageKey,
             package.ecosystem AS ecosystem,
             package.role AS packageRole,
             package.weeklyDownloads AS weeklyDownloads,
             introducedIn,
             fixedIn,
             affected,
             maintainers
    `,
    params: { id },
    map: (records) => {
      const record = records[0];
      if (!record) return null;
      const affected = (record.get('affected') as Array<Record<string, unknown>>)
        .map((row) => ({
          key: asString(row.key),
          version: asString(row.version),
          published: asString(row.published),
          ordinal: asNumber(row.ordinal),
        }))
        .sort((a, b) => b.ordinal - a.ordinal)
        .map(({ key, version, published }) => ({ key, version, published }));

      const maintainers = (record.get('maintainers') as Array<Record<string, unknown> | null>)
        .filter((row): row is Record<string, unknown> => row !== null)
        .map((row) => ({
          handle: asString(row.handle),
          name: asString(row.name),
          twoFactorEnabled: row.twoFactorEnabled === true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: asString(record.get('id')),
        title: asString(record.get('title')),
        severity: asSeverity(record.get('severity')),
        score: asNumber(record.get('score')),
        weakness: asString(record.get('weakness')),
        summary: asString(record.get('summary')),
        published: asString(record.get('published')),
        synthetic: record.get('synthetic') !== false,
        packageName: asString(record.get('packageName')),
        packageKey: asString(record.get('packageKey')),
        ecosystem: asEcosystem(record.get('ecosystem')),
        packageRole: asString(record.get('packageRole')),
        weeklyDownloads: asNumber(record.get('weeklyDownloads')),
        introducedIn: record.get('introducedIn') === null ? null : asString(record.get('introducedIn')),
        fixedIn: record.get('fixedIn') === null ? null : asString(record.get('fixedIn')),
        affected,
        maintainers,
      };
    },
  });
}

export type BlastRadiusRow = {
  slug: string;
  name: string;
  team: string;
  tier: string;
  reached: boolean;
  affectedReleasesReached: number;
  shortest: Route | null;
  target: { key: string; name: string; version: string } | null;
};

/** **The headline query.** For one advisory, the shortest dependency path from */
export function getBlastRadius(advisoryId: string): Promise<Outcome<BlastRadiusRow[]>> {
  return read({
    name: 'Blast radius',
    purpose: 'The shortest dependency path from every application to a release affected by this advisory, and which applications have none.',
    cypher: `
      MATCH (:Advisory { id: $advisoryId })-[:AFFECTS]->(vulnerable:PackageVersion)
      WITH collect(DISTINCT vulnerable) AS vulnerableReleases
      MATCH (application:Application)
      UNWIND vulnerableReleases AS vulnerable
      OPTIONAL MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(vulnerable))
      WITH application, vulnerable, route
      ORDER BY length(route) ASC, vulnerable.ordinal DESC
      WITH application,
           collect(CASE WHEN route IS NULL THEN null ELSE {
             route: ${ROUTE_PROJECTION},
             target: { key: vulnerable.key, name: vulnerable.name, version: vulnerable.version }
           } END) AS routes
      RETURN application.slug AS slug,
             application.name AS name,
             application.team AS team,
             application.tier AS tier,
             size(routes) AS affectedReleasesReached,
             head(routes) AS best
      ORDER BY CASE WHEN size(routes) = 0 THEN 1 ELSE 0 END ASC,
               coalesce(head(routes).route.depth, 99) ASC,
               application.name ASC
    `,
    params: { advisoryId },
    map: (records) =>
      records.map((record) => {
        const best = record.get('best') as Record<string, unknown> | null;
        const target = (best?.target ?? null) as Record<string, unknown> | null;
        const reachedCount = asNumber(record.get('affectedReleasesReached'));
        return {
          slug: asString(record.get('slug')),
          name: asString(record.get('name')),
          team: asString(record.get('team')),
          tier: asString(record.get('tier')),
          reached: reachedCount > 0,
          affectedReleasesReached: reachedCount,
          shortest: best ? mapRoute(best.route) : null,
          target: target
            ? { key: asString(target.key), name: asString(target.name), version: asString(target.version) }
            : null,
        };
      }),
  });
}

export type CutPoint = {
  packageName: string;
  ecosystem: Ecosystem;
  version: string;
  versionKey: string;
  applications: Array<{ slug: string; name: string; depth: number }>;
  applicationCount: number;
};

/** Where the runs converge. */
export function getCutPoints(advisoryId: string, limit = 12): Promise<Outcome<CutPoint[]>> {
  return read({
    name: 'Cut points',
    purpose: 'Counts how many applications\u2019 shortest paths pass through each intermediate hop \u2014 the cheapest place to break the chain.',
    cypher: `
      MATCH (:Advisory { id: $advisoryId })-[:AFFECTS]->(vulnerable:PackageVersion)
      WITH collect(DISTINCT vulnerable) AS vulnerableReleases
      MATCH (application:Application)
      UNWIND vulnerableReleases AS vulnerable
      MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(vulnerable))
      WITH application, route
      ORDER BY length(route) ASC
      WITH application, head(collect(route)) AS shortest
      WITH application, length(shortest) AS depth, nodes(shortest)[1..-1] AS junctions
      UNWIND junctions AS junction
      WITH junction,
           collect(DISTINCT { slug: application.slug, name: application.name, depth: depth }) AS applications
      RETURN junction.name AS packageName,
             junction.ecosystem AS ecosystem,
             junction.version AS version,
             junction.key AS versionKey,
             applications,
             size(applications) AS applicationCount
      ORDER BY applicationCount DESC, packageName ASC
      LIMIT $limit
    `,
    params: { advisoryId, limit },
    map: (records) =>
      records.map((record) => ({
        packageName: asString(record.get('packageName')),
        ecosystem: asEcosystem(record.get('ecosystem')),
        version: asString(record.get('version')),
        versionKey: asString(record.get('versionKey')),
        applications: (record.get('applications') as Array<Record<string, unknown>>)
          .map((row) => ({
            slug: asString(row.slug),
            name: asString(row.name),
            depth: asNumber(row.depth),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        applicationCount: asNumber(record.get('applicationCount')),
      })),
  });
}
