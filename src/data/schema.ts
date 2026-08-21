export const CONSTRAINTS: readonly string[] = [
  'CREATE CONSTRAINT application_slug IF NOT EXISTS FOR (a:Application) REQUIRE a.slug IS UNIQUE',
  'CREATE CONSTRAINT package_key IF NOT EXISTS FOR (p:Package) REQUIRE p.key IS UNIQUE',
  'CREATE CONSTRAINT package_version_key IF NOT EXISTS FOR (v:PackageVersion) REQUIRE v.key IS UNIQUE',
  'CREATE CONSTRAINT maintainer_handle IF NOT EXISTS FOR (m:Maintainer) REQUIRE m.handle IS UNIQUE',
  'CREATE CONSTRAINT advisory_id IF NOT EXISTS FOR (a:Advisory) REQUIRE a.id IS UNIQUE',
  'CREATE CONSTRAINT license_spdx IF NOT EXISTS FOR (l:License) REQUIRE l.spdxId IS UNIQUE',
];

export const INDEXES: readonly string[] = [
  'CREATE INDEX application_name IF NOT EXISTS FOR (a:Application) ON (a.name)',
  'CREATE INDEX package_name IF NOT EXISTS FOR (p:Package) ON (p.name)',
  'CREATE INDEX package_version_name IF NOT EXISTS FOR (v:PackageVersion) ON (v.name)',
  'CREATE INDEX maintainer_name IF NOT EXISTS FOR (m:Maintainer) ON (m.name)',
  'CREATE INDEX advisory_severity IF NOT EXISTS FOR (a:Advisory) ON (a.severity)',
  'CREATE INDEX license_category IF NOT EXISTS FOR (l:License) ON (l.category)',
];

// Parameterized Cypher write statements for graph seeding
export const WRITES = {
  applications: `
    UNWIND $rows AS row
    MERGE (application:Application { slug: row.slug })
    SET application.name = row.name,
        application.team = row.team,
        application.tier = row.tier,
        application.runtime = row.runtime,
        application.purpose = row.purpose,
        application.firstShipped = row.firstShipped
  `,

  licenses: `
    UNWIND $rows AS row
    MERGE (license:License { spdxId: row.spdxId })
    SET license.name = row.name,
        license.category = row.category,
        license.note = row.note
  `,

  maintainers: `
    UNWIND $rows AS row
    MERGE (maintainer:Maintainer { handle: row.handle })
    SET maintainer.name = row.name,
        maintainer.joined = row.joined,
        maintainer.twoFactorEnabled = row.twoFactorEnabled,
        maintainer.affiliation = row.affiliation
  `,

  packages: `
    UNWIND $rows AS row
    MERGE (package:Package { key: row.key })
    SET package.ecosystem = row.ecosystem,
        package.name = row.name,
        package.role = row.role,
        package.weeklyDownloads = row.weeklyDownloads,
        package.deprecated = row.deprecated
  `,

  advisories: `
    UNWIND $rows AS row
    MERGE (advisory:Advisory { id: row.id })
    SET advisory.title = row.title,
        advisory.severity = row.severity,
        advisory.score = row.score,
        advisory.weakness = row.weakness,
        advisory.summary = row.summary,
        advisory.published = row.published,
        advisory.synthetic = row.synthetic
  `,

  /** Versions carry `name` and `ecosystem` denormalised from their package. */
  versions: `
    UNWIND $rows AS row
    MATCH (package:Package { key: row.packageKey })
    MERGE (version:PackageVersion { key: row.key })
    SET version.ecosystem = row.ecosystem,
        version.name = row.name,
        version.version = row.version,
        version.published = row.published,
        version.ordinal = row.ordinal
    MERGE (version)-[:VERSION_OF]->(package)
  `,

  licensing: `
    UNWIND $rows AS row
    MATCH (version:PackageVersion { key: row.versionKey })
    MATCH (license:License { spdxId: row.spdxId })
    MERGE (version)-[:LICENSED_UNDER]->(license)
  `,

  maintenance: `
    UNWIND $rows AS row
    MATCH (package:Package { key: row.packageKey })
    MATCH (maintainer:Maintainer { handle: row.handle })
    MERGE (package)-[link:MAINTAINED_BY]->(maintainer)
    SET link.role = row.role,
        link.since = row.since
  `,

  applicationDependencies: `
    UNWIND $rows AS row
    MATCH (application:Application { slug: row.from })
    MATCH (version:PackageVersion { key: row.to })
    MERGE (application)-[edge:DEPENDS_ON]->(version)
    SET edge.scope = row.scope,
        edge.range = row.range,
        edge.direct = true
  `,

  versionDependencies: `
    UNWIND $rows AS row
    MATCH (source:PackageVersion { key: row.from })
    MATCH (target:PackageVersion { key: row.to })
    MERGE (source)-[edge:DEPENDS_ON]->(target)
    SET edge.scope = row.scope,
        edge.range = row.range,
        edge.direct = false
  `,

  affects: `
    UNWIND $rows AS row
    MATCH (advisory:Advisory { id: row.advisoryId })
    MATCH (version:PackageVersion { key: row.versionKey })
    MERGE (advisory)-[edge:AFFECTS]->(version)
    SET edge.introducedIn = row.introducedIn,
        edge.fixedIn = row.fixedIn
  `,

  supersessions: `
    UNWIND $rows AS row
    MATCH (old:Package { key: row.from })
    MATCH (replacement:Package { key: row.to })
    MERGE (old)-[edge:SUPERSEDED_BY]->(replacement)
    SET edge.reason = row.reason
  `,
} as const;

export const DELETE_BATCH = `
  MATCH (node)
  WITH node LIMIT $batchSize
  DETACH DELETE node
  RETURN count(node) AS deleted
`;

export const COUNT_NODES = 'MATCH (node) RETURN count(node) AS total';
export const COUNT_RELATIONSHIPS = 'MATCH ()-[edge]->() RETURN count(edge) AS total';
