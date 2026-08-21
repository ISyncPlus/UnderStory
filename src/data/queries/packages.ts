import 'server-only';

import type { Outcome } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import type { Ecosystem, LicenseCategory, Severity } from '../model';
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

export type PackageDetail = {
  key: string;
  name: string;
  ecosystem: Ecosystem;
  role: string;
  weeklyDownloads: number;
  deprecated: boolean;
  supersededBy: { key: string; name: string; reason: string } | null;
  maintainers: Array<{
    handle: string;
    name: string;
    twoFactorEnabled: boolean;
    affiliation: string | null;
    role: string;
  }>;
  releases: Array<{
    key: string;
    version: string;
    published: string;
    license: string | null;
    licenseCategory: LicenseCategory | null;
    advisories: Array<{ id: string; severity: Severity }>;
  }>;
};

export function getPackage(key: string): Promise<Outcome<PackageDetail | null>> {
  return read({
    name: 'Package record',
    purpose: 'One package: its releases, the licence each release carries, any advisory on it, and who can publish it.',
    cypher: `
      MATCH (package:Package { key: $key })
      OPTIONAL MATCH (package)-[supersession:SUPERSEDED_BY]->(replacement:Package)
      OPTIONAL MATCH (package)-[maintenance:MAINTAINED_BY]->(maintainer:Maintainer)
      WITH package, supersession, replacement,
           collect(DISTINCT CASE WHEN maintainer IS NULL THEN null ELSE {
             handle: maintainer.handle,
             name: maintainer.name,
             twoFactorEnabled: maintainer.twoFactorEnabled,
             affiliation: maintainer.affiliation,
             role: maintenance.role
           } END) AS maintainers

      MATCH (version:PackageVersion)-[:VERSION_OF]->(package)
      OPTIONAL MATCH (version)-[:LICENSED_UNDER]->(license:License)
      OPTIONAL MATCH (advisory:Advisory)-[:AFFECTS]->(version)
      WITH package, supersession, replacement, maintainers, version, license,
           collect(DISTINCT CASE WHEN advisory IS NULL THEN null ELSE {
             id: advisory.id, severity: advisory.severity
           } END) AS advisories
      WITH package, supersession, replacement, maintainers,
           collect({
             key: version.key,
             version: version.version,
             ordinal: version.ordinal,
             published: version.published,
             license: license.spdxId,
             licenseCategory: license.category,
             advisories: advisories
           }) AS releases

      RETURN package.key AS key,
             package.name AS name,
             package.ecosystem AS ecosystem,
             package.role AS role,
             package.weeklyDownloads AS weeklyDownloads,
             coalesce(package.deprecated, false) AS deprecated,
             CASE WHEN replacement IS NULL THEN null ELSE {
               key: replacement.key, name: replacement.name, reason: supersession.reason
             } END AS supersededBy,
             maintainers,
             releases
    `,
    params: { key },
    map: (records) => {
      const record = records[0];
      if (!record) return null;
      const supersededBy = record.get('supersededBy') as Record<string, unknown> | null;
      return {
        key: asString(record.get('key')),
        name: asString(record.get('name')),
        ecosystem: asEcosystem(record.get('ecosystem')),
        role: asString(record.get('role')),
        weeklyDownloads: asNumber(record.get('weeklyDownloads')),
        deprecated: record.get('deprecated') === true,
        supersededBy: supersededBy
          ? {
              key: asString(supersededBy.key),
              name: asString(supersededBy.name),
              reason: asString(supersededBy.reason),
            }
          : null,
        maintainers: (record.get('maintainers') as Array<Record<string, unknown> | null>)
          .filter((row): row is Record<string, unknown> => row !== null)
          .map((row) => ({
            handle: asString(row.handle),
            name: asString(row.name),
            twoFactorEnabled: row.twoFactorEnabled === true,
            affiliation: row.affiliation == null ? null : asString(row.affiliation),
            role: asString(row.role, 'publisher'),
          }))
          .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)),
        releases: (record.get('releases') as Array<Record<string, unknown>>)
          .map((row) => ({
            key: asString(row.key),
            version: asString(row.version),
            ordinal: asNumber(row.ordinal),
            published: asString(row.published),
            license: row.license == null ? null : asString(row.license),
            licenseCategory: row.licenseCategory == null ? null : (asString(row.licenseCategory) as LicenseCategory),
            advisories: (Array.isArray(row.advisories) ? row.advisories : [])
              .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
              .map((item) => ({ id: asString(item.id), severity: asSeverity(item.severity) })),
          }))
          .sort((a, b) => b.ordinal - a.ordinal)
          .map(({ ordinal: _ordinal, ...release }) => release),
      };
    },
  });
}

export type PackageReach = {
  applications: Array<{ slug: string; name: string; team: string; depth: number; route: Route | null }>;
  directDependents: Array<{ key: string; name: string; version: string; ecosystem: Ecosystem }>;
  directDependentCount: number;
};

/** Who reaches this package, and who pulls it in directly. */
export function getPackageReach(key: string): Promise<Outcome<PackageReach>> {
  return read({
    name: 'Package reach',
    purpose: 'Which applications can reach any release of this package, by what route, and which releases depend on it directly.',
    cypher: `
      MATCH (package:Package { key: $key })<-[:VERSION_OF]-(version:PackageVersion)
      WITH collect(DISTINCT version) AS releases

      MATCH (application:Application)
      UNWIND releases AS release
      OPTIONAL MATCH route = shortestPath((application)-[:DEPENDS_ON*1..${PATH_DEPTH}]->(release))
      WITH releases, application, route
      ORDER BY length(route) ASC
      WITH releases, application, head(collect(CASE WHEN route IS NULL THEN null ELSE ${ROUTE_PROJECTION} END)) AS best
      WITH releases,
           collect(CASE WHEN best IS NULL THEN null ELSE {
             slug: application.slug, name: application.name, team: application.team, route: best
           } END) AS reachedApplications

      UNWIND releases AS release
      OPTIONAL MATCH (dependent:PackageVersion)-[:DEPENDS_ON]->(release)
      WITH reachedApplications,
           collect(DISTINCT CASE WHEN dependent IS NULL THEN null ELSE {
             key: dependent.key, name: dependent.name,
             version: dependent.version, ecosystem: dependent.ecosystem
           } END) AS dependents

      RETURN reachedApplications,
             dependents[0..$dependentLimit] AS directDependents,
             size(dependents) AS directDependentCount
    `,
    params: { key, dependentLimit: 40 },
    map: (records) => {
      const record = records[0];
      if (!record) return { applications: [], directDependents: [], directDependentCount: 0 };
      const applications = (record.get('reachedApplications') as Array<Record<string, unknown> | null>)
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
        .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

      return {
        applications,
        directDependents: (record.get('directDependents') as Array<Record<string, unknown> | null>)
          .filter((row): row is Record<string, unknown> => row !== null)
          .map((row) => ({
            key: asString(row.key),
            name: asString(row.name),
            version: asString(row.version),
            ecosystem: asEcosystem(row.ecosystem),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        directDependentCount: asNumber(record.get('directDependentCount')),
      };
    },
  });
}

export type LoadBearingPackage = {
  key: string;
  name: string;
  ecosystem: Ecosystem;
  role: string;
  applicationsReached: number;
  maintainerCount: number;
  weeklyDownloads: number;
};

/** The packages the most of the estate sits on top of. */
export function getLoadBearingPackages(limit = 12): Promise<Outcome<LoadBearingPackage[]>> {
  return read({
    name: 'Load-bearing packages',
    purpose: 'Packages ranked by how many of the estate’s applications reach them transitively, not by how popular they are.',
    cypher: `
      MATCH (application:Application)-[:DEPENDS_ON*1..${REACH_DEPTH}]->(version:PackageVersion)
      WITH DISTINCT application, version
      MATCH (version)-[:VERSION_OF]->(package:Package)
      WITH package, count(DISTINCT application) AS applicationsReached
      OPTIONAL MATCH (package)-[:MAINTAINED_BY]->(maintainer:Maintainer)
      RETURN package.key AS key,
             package.name AS name,
             package.ecosystem AS ecosystem,
             package.role AS role,
             package.weeklyDownloads AS weeklyDownloads,
             applicationsReached,
             count(DISTINCT maintainer) AS maintainerCount
      ORDER BY applicationsReached DESC, maintainerCount ASC, package.name ASC
      LIMIT $limit
    `,
    params: { limit },
    map: (records) =>
      records.map((record) => ({
        key: asString(record.get('key')),
        name: asString(record.get('name')),
        ecosystem: asEcosystem(record.get('ecosystem')),
        role: asString(record.get('role')),
        applicationsReached: asNumber(record.get('applicationsReached')),
        maintainerCount: asNumber(record.get('maintainerCount')),
        weeklyDownloads: asNumber(record.get('weeklyDownloads')),
      })),
  });
}
