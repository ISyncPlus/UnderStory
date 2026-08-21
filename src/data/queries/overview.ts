import 'server-only';

import type { Outcome, QueryMeta } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import { SEVERITY_RANK, type Severity } from '../model';
import { REACH_DEPTH, asNumber, asSeverity, asString } from './shared';

export type EstateSummary = {
  applications: number;
  packages: number;
  versions: number;
  maintainers: number;
  advisories: number;
  dependencies: number;
  directDependencies: number;
};

/** Inventory of the whole graph. */
export function getEstateSummary(): Promise<Outcome<EstateSummary>> {
  return read({
    name: 'Estate inventory',
    purpose: 'How much is in the graph: applications, packages, releases, maintainers, advisories and dependency edges.',
    cypher: `
      MATCH (application:Application)
      WITH count(application) AS applications
      MATCH (package:Package)
      WITH applications, count(package) AS packages
      MATCH (version:PackageVersion)
      WITH applications, packages, count(version) AS versions
      MATCH (maintainer:Maintainer)
      WITH applications, packages, versions, count(maintainer) AS maintainers
      MATCH (advisory:Advisory)
      WITH applications, packages, versions, maintainers, count(advisory) AS advisories
      MATCH ()-[edge:DEPENDS_ON]->()
      RETURN applications,
             packages,
             versions,
             maintainers,
             advisories,
             count(edge) AS dependencies,
             sum(CASE WHEN edge.direct THEN 1 ELSE 0 END) AS directDependencies
    `,
    params: {},
    map: (records) => {
      const row = records[0];
      return {
        applications: asNumber(row?.get('applications')),
        packages: asNumber(row?.get('packages')),
        versions: asNumber(row?.get('versions')),
        maintainers: asNumber(row?.get('maintainers')),
        advisories: asNumber(row?.get('advisories')),
        dependencies: asNumber(row?.get('dependencies')),
        directDependencies: asNumber(row?.get('directDependencies')),
      };
    },
  });
}

export type ApplicationInventory = {
  slug: string;
  name: string;
  team: string;
  tier: string;
  runtime: string;
  purpose: string;
  directDependencies: number;
  reachablePackages: number;
};

/** One row per application: what it declares, and how far that actually goes. */
export function getApplicationInventory(): Promise<Outcome<ApplicationInventory[]>> {
  return read({
    name: 'Application inventory',
    purpose: 'Direct dependency count and total transitive package reach, per application.',
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
      ORDER BY application.name ASC
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

export type ApplicationAdvisoryHit = {
  slug: string;
  advisoryId: string;
  severity: Severity;
};

/** Reachable advisories per application. */
export function getApplicationAdvisoryHits(): Promise<Outcome<ApplicationAdvisoryHit[]>> {
  return read({
    name: 'Advisory reach',
    purpose: 'Every (application, advisory) pair where the application can reach an affected release within the traversal bound.',
    cypher: `
      MATCH (advisory:Advisory)-[:AFFECTS]->(vulnerable:PackageVersion)
      MATCH (application:Application)-[:DEPENDS_ON*1..${REACH_DEPTH}]->(vulnerable)
      WITH DISTINCT application, advisory
      RETURN application.slug AS slug,
             advisory.id AS advisoryId,
             advisory.severity AS severity
    `,
    params: {},
    map: (records) =>
      records.map((record) => ({
        slug: asString(record.get('slug')),
        advisoryId: asString(record.get('advisoryId')),
        severity: asSeverity(record.get('severity')),
      })),
  });
}

export type ApplicationExposure = ApplicationInventory & {
  advisoryCount: number;
  worstSeverity: Severity | null;
  severityCounts: Record<Severity, number>;
};

export type OverviewData = {
  summary: EstateSummary;
  exposure: ApplicationExposure[];
  totals: Record<Severity, number>;
  advisoriesWithReach: number;
};

/** Composes the overview from three focused queries rather than one clever one. */
export async function getOverview(): Promise<Outcome<OverviewData> & { queries?: QueryMeta[] }> {
  const [summary, inventory, hits] = await Promise.all([
    getEstateSummary(),
    getApplicationInventory(),
    getApplicationAdvisoryHits(),
  ]);

  if (!summary.ok) return summary;
  if (!inventory.ok) return inventory;
  if (!hits.ok) return hits;

  const bySlug = new Map<string, ApplicationAdvisoryHit[]>();
  for (const hit of hits.data) {
    const list = bySlug.get(hit.slug) ?? [];
    list.push(hit);
    bySlug.set(hit.slug, list);
  }

  const totals: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const distinctAdvisories = new Set<string>();

  const exposure: ApplicationExposure[] = inventory.data.map((application) => {
    const found = bySlug.get(application.slug) ?? [];
    const severityCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const hit of found) {
      severityCounts[hit.severity] += 1;
      distinctAdvisories.add(hit.advisoryId);
    }
    const worstSeverity =
      found.length === 0
        ? null
        : found
            .map((hit) => hit.severity)
            .reduce((worst, current) => (SEVERITY_RANK[current] > SEVERITY_RANK[worst] ? current : worst));
    return { ...application, advisoryCount: found.length, worstSeverity, severityCounts };
  });

  for (const hit of hits.data) totals[hit.severity] += 1;

  exposure.sort(
    (a, b) =>
      (b.worstSeverity ? SEVERITY_RANK[b.worstSeverity] : 0) -
        (a.worstSeverity ? SEVERITY_RANK[a.worstSeverity] : 0) ||
      b.advisoryCount - a.advisoryCount ||
      a.name.localeCompare(b.name),
  );

  return {
    ok: true,
    data: {
      summary: summary.data,
      exposure,
      totals,
      advisoriesWithReach: distinctAdvisories.size,
    },
    meta: hits.meta,
    queries: [summary.meta, inventory.meta, hits.meta],
  };
}
