import 'server-only';

import type { Outcome } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import type { Ecosystem } from '../model';
import { PATH_DEPTH, REACH_DEPTH, ROUTE_PROJECTION, asEcosystem, asNumber, asString, mapRoute, type Route } from './shared';

export type Chokepoint = {
  handle: string;
  name: string;
  affiliation: string | null;
  joined: string;
  packages: Array<{ key: string; name: string; ecosystem: Ecosystem }>;
  applications: string[];
  packageCount: number;
  applicationCount: number;
};

/** Single points of failure that no advisory will ever tell you about. */
export function getChokepoints(limit = 8, candidateLimit = 40): Promise<Outcome<Chokepoint[]>> {
  return read({
    name: 'Maintainer chokepoints',
    purpose: 'Sole maintainers without two-factor authentication, ranked by how many of the estate’s applications sit above their packages.',
    cypher: `
      MATCH (package:Package)-[:MAINTAINED_BY]->(maintainer:Maintainer)
      WITH package, collect(maintainer) AS maintainers
      WHERE size(maintainers) = 1 AND head(maintainers).twoFactorEnabled = false

      WITH head(maintainers) AS maintainer, collect(package) AS packages
      WITH maintainer, packages,
           reduce(weight = 0, item IN packages | weight + coalesce(item.weeklyDownloads, 0)) AS weight
      ORDER BY weight DESC
      LIMIT $candidateLimit

      UNWIND packages AS package
      MATCH (version:PackageVersion)-[:VERSION_OF]->(package)
      MATCH (application:Application)-[:DEPENDS_ON*1..${REACH_DEPTH}]->(version)
      WITH DISTINCT maintainer, package, application

      RETURN maintainer.handle AS handle,
             maintainer.name AS name,
             maintainer.affiliation AS affiliation,
             maintainer.joined AS joined,
             collect(DISTINCT { key: package.key, name: package.name, ecosystem: package.ecosystem }) AS packages,
             collect(DISTINCT application.name) AS applications,
             count(DISTINCT package) AS packageCount,
             count(DISTINCT application) AS applicationCount
      ORDER BY applicationCount DESC, packageCount DESC, name ASC
      LIMIT $limit
    `,
    params: { limit, candidateLimit },
    map: (records) =>
      records.map((record) => ({
        handle: asString(record.get('handle')),
        name: asString(record.get('name')),
        affiliation: record.get('affiliation') == null ? null : asString(record.get('affiliation')),
        joined: asString(record.get('joined')),
        packages: (record.get('packages') as Array<Record<string, unknown>>)
          .map((row) => ({
            key: asString(row.key),
            name: asString(row.name),
            ecosystem: asEcosystem(row.ecosystem),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        applications: (record.get('applications') as unknown[]).map((value) => asString(value)).sort(),
        packageCount: asNumber(record.get('packageCount')),
        applicationCount: asNumber(record.get('applicationCount')),
      })),
  });
}

export type MaintainerProfile = {
  handle: string;
  name: string;
  affiliation: string | null;
  joined: string;
  twoFactorEnabled: boolean;
  packages: Array<{
    key: string;
    name: string;
    ecosystem: Ecosystem;
    role: string;
    soleMaintainer: boolean;
    weeklyDownloads: number;
  }>;
  reach: Array<{ slug: string; name: string; team: string; depth: number; route: Route | null }>;
};

export function getMaintainer(handle: string): Promise<Outcome<MaintainerProfile | null>> {
  return read({
    name: 'Maintainer profile',
    purpose: 'What one maintainer can publish, whether anyone else can, and which applications sit above their work.',
    cypher: `
      MATCH (maintainer:Maintainer { handle: $handle })
      OPTIONAL MATCH (package:Package)-[:MAINTAINED_BY]->(maintainer)
      OPTIONAL MATCH (package)-[:MAINTAINED_BY]->(other:Maintainer)
      WITH maintainer, package, count(DISTINCT other) AS maintainerCount
      WITH maintainer,
           collect(CASE WHEN package IS NULL THEN null ELSE {
             key: package.key, name: package.name, ecosystem: package.ecosystem,
             role: package.role, weeklyDownloads: package.weeklyDownloads,
             soleMaintainer: maintainerCount = 1
           } END) AS packages

      OPTIONAL MATCH (owned:Package)-[:MAINTAINED_BY]->(maintainer)
      OPTIONAL MATCH (version:PackageVersion)-[:VERSION_OF]->(owned)
      MATCH (application:Application)
      OPTIONAL MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(version))
      WITH maintainer, packages, application, route
      ORDER BY length(route) ASC
      WITH maintainer, packages, application,
           head(collect(CASE WHEN route IS NULL THEN null ELSE ${ROUTE_PROJECTION} END)) AS best

      RETURN maintainer.handle AS handle,
             maintainer.name AS name,
             maintainer.affiliation AS affiliation,
             maintainer.joined AS joined,
             maintainer.twoFactorEnabled AS twoFactorEnabled,
             head(collect(packages)) AS packages,
             collect(CASE WHEN best IS NULL THEN null ELSE {
               slug: application.slug, name: application.name, team: application.team, route: best
             } END) AS reach
    `,
    params: { handle },
    map: (records) => {
      const record = records[0];
      if (!record) return null;
      return {
        handle: asString(record.get('handle')),
        name: asString(record.get('name')),
        affiliation: record.get('affiliation') == null ? null : asString(record.get('affiliation')),
        joined: asString(record.get('joined')),
        twoFactorEnabled: record.get('twoFactorEnabled') === true,
        packages: ((record.get('packages') ?? []) as Array<Record<string, unknown> | null>)
          .filter((row): row is Record<string, unknown> => row !== null)
          .map((row) => ({
            key: asString(row.key),
            name: asString(row.name),
            ecosystem: asEcosystem(row.ecosystem),
            role: asString(row.role),
            soleMaintainer: row.soleMaintainer === true,
            weeklyDownloads: asNumber(row.weeklyDownloads),
          }))
          .sort((a, b) => b.weeklyDownloads - a.weeklyDownloads),
        reach: (record.get('reach') as Array<Record<string, unknown> | null>)
          .filter((row): row is Record<string, unknown> => row !== null)
          .map((row) => {
            const route = mapRoute(row.route);
            return {
              slug: asString(row.slug),
              name: asString(row.name),
              team: asString(row.team),
              depth: route?.depth ?? 0,
              route,
            };
          })
          .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name)),
      };
    },
  });
}
