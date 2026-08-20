import type { Record as Neo4jRecord } from 'neo4j-driver';

import { RECIPROCAL_CATEGORIES, SEVERITY_RANK, type Severity } from '@/data/model';
import { PATH_DEPTH, REACH_DEPTH } from '@/data/queries/shared';
import type { Outcome, QueryMeta } from './errors';
import { fixtureGraph } from './fixtures/graph';
import type { Health, ReadQuery } from './neo4j';

/**
 * Fixture-backed stand-in for the Bolt driver.
 *
 * `next.config.ts` resolves `@/lib/neo4j` to this module only when
 * `UNDERSTORY_FIXTURES=1`, which `npm run dev:fixtures` and the screenshot
 * script set. A production build never sees it.
 *
 * The important detail: it fabricates *driver records*, not application data.
 * Each fixture returns rows shaped exactly like the columns the real Cypher
 * returns, and the query module's own `map` function runs over them unchanged.
 * That means the mapping layer — the part most likely to be wrong — is
 * exercised by every screenshot and every fixture run, rather than mocked out.
 */

type Fields = Record<string, unknown>;

function record(fields: Fields): Neo4jRecord {
  return {
    get: (key: string) => fields[key as string],
    has: (key: string) => Object.prototype.hasOwnProperty.call(fields, key),
    keys: Object.keys(fields),
    length: Object.keys(fields).length,
    toObject: () => fields,
    forEach: () => undefined,
    entries: () => Object.entries(fields)[Symbol.iterator](),
    values: () => Object.values(fields)[Symbol.iterator](),
    [Symbol.iterator]: () => Object.values(fields)[Symbol.iterator](),
  } as unknown as Neo4jRecord;
}

function routeShape(route: { depth: number; hops: unknown[]; edges: unknown[] } | null) {
  return route;
}

/* eslint-disable complexity */
function rowsFor(name: string, params: Record<string, unknown>): Fields[] {
  const graph = fixtureGraph();
  const data = graph.data;

  switch (name) {
    case 'Estate inventory':
      return [
        {
          applications: data.applications.length,
          packages: data.packages.length,
          versions: data.versions.length,
          maintainers: data.maintainers.length,
          advisories: data.advisories.length,
          dependencies: data.applicationDependencies.length + data.versionDependencies.length,
          directDependencies: data.applicationDependencies.length,
        },
      ];

    case 'Application inventory':
    case 'Applications': {
      const rows = data.applications.map((application) => {
        const reach = graph.reach(application.slug, REACH_DEPTH);
        const names = new Set<string>();
        for (const key of reach.keys()) {
          const version = graph.versionByKey.get(key);
          if (version) names.add(version.name);
        }
        return {
          slug: application.slug,
          name: application.name,
          team: application.team,
          tier: application.tier,
          runtime: application.runtime,
          purpose: application.purpose,
          directDependencies: (graph.appEdges.get(application.slug) ?? []).length,
          reachablePackages: names.size,
        };
      });
      return name === 'Applications'
        ? rows.sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name))
        : rows.sort((a, b) => a.name.localeCompare(b.name));
    }

    case 'Advisory reach': {
      const out: Fields[] = [];
      for (const application of data.applications) {
        const reach = graph.reach(application.slug, REACH_DEPTH);
        const seen = new Set<string>();
        for (const key of reach.keys()) {
          for (const advisoryId of graph.advisoriesByVersion.get(key) ?? []) {
            if (seen.has(advisoryId)) continue;
            seen.add(advisoryId);
            out.push({
              slug: application.slug,
              advisoryId,
              severity: graph.advisoryById.get(advisoryId)?.severity ?? 'low',
            });
          }
        }
      }
      return out;
    }

    case 'Advisory catalogue': {
      const severities = (params.severities as string[]) ?? [];
      const search = String(params.search ?? '');
      return data.advisories
        .map((advisory) => {
          const versions = (graph.affectedByAdvisory.get(advisory.id) ?? [])
            .map((key) => graph.versionByKey.get(key))
            .filter((version): version is NonNullable<typeof version> => Boolean(version));
          const first = versions[0];
          const edge = data.affects.find((item) => item.advisoryId === advisory.id);
          return {
            id: advisory.id,
            title: advisory.title,
            severity: advisory.severity,
            score: advisory.score,
            weakness: advisory.weakness,
            summary: advisory.summary,
            published: advisory.published,
            packageName: first?.name ?? '',
            ecosystem: first?.ecosystem ?? 'npm',
            fixedIn: edge?.fixedIn ?? null,
            affectedReleases: versions.length,
          };
        })
        .filter((row) => severities.length === 0 || severities.includes(row.severity))
        .filter(
          (row) =>
            search === '' ||
            row.id.toLowerCase().includes(search) ||
            row.title.toLowerCase().includes(search) ||
            row.packageName.toLowerCase().includes(search),
        )
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    }

    case 'Advisory reach counts': {
      const counts = new Map<string, Set<string>>();
      for (const application of data.applications) {
        const reach = graph.reach(application.slug, REACH_DEPTH);
        for (const key of reach.keys()) {
          for (const advisoryId of graph.advisoriesByVersion.get(key) ?? []) {
            const set = counts.get(advisoryId) ?? new Set<string>();
            set.add(application.slug);
            counts.set(advisoryId, set);
          }
        }
      }
      return [...counts.entries()]
        .map(([id, apps]) => ({ id, applicationsReached: apps.size }))
        .sort((a, b) => b.applicationsReached - a.applicationsReached || a.id.localeCompare(b.id));
    }

    case 'Advisory record': {
      const advisory = graph.advisoryById.get(String(params.id));
      if (!advisory) return [];
      const versionKeys = graph.affectedByAdvisory.get(advisory.id) ?? [];
      const versions = versionKeys
        .map((key) => graph.versionByKey.get(key))
        .filter((version): version is NonNullable<typeof version> => Boolean(version));
      const first = versions[0];
      const packageKey = first ? `${first.ecosystem}:${first.name}` : '';
      const pkg = graph.packageByKey.get(packageKey);
      const edge = data.affects.find((item) => item.advisoryId === advisory.id);
      return [
        {
          id: advisory.id,
          title: advisory.title,
          severity: advisory.severity,
          score: advisory.score,
          weakness: advisory.weakness,
          summary: advisory.summary,
          published: advisory.published,
          synthetic: true,
          packageName: pkg?.name ?? '',
          packageKey,
          ecosystem: pkg?.ecosystem ?? 'npm',
          packageRole: pkg?.role ?? '',
          weeklyDownloads: pkg?.weeklyDownloads ?? 0,
          introducedIn: edge?.introducedIn ?? null,
          fixedIn: edge?.fixedIn ?? null,
          affected: versions.map((version) => ({
            key: version.key,
            version: version.version,
            published: version.published,
            ordinal: version.ordinal,
          })),
          maintainers: (graph.maintainersByPackage.get(packageKey) ?? []).map((handle) => {
            const person = graph.maintainerByHandle.get(handle);
            return {
              handle,
              name: person?.name ?? handle,
              twoFactorEnabled: person?.twoFactorEnabled ?? false,
            };
          }),
        },
      ];
    }

    case 'Blast radius': {
      const versionKeys = graph.affectedByAdvisory.get(String(params.advisoryId)) ?? [];
      return data.applications
        .map((application) => {
          const routes = versionKeys
            .map((key) => {
              const route = graph.shortestRoute(application.slug, key, PATH_DEPTH);
              if (!route) return null;
              const version = graph.versionByKey.get(key);
              return {
                route: routeShape(route),
                target: { key, name: version?.name ?? '', version: version?.version ?? '' },
                ordinal: version?.ordinal ?? 0,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
            .sort((a, b) => a.route!.depth - b.route!.depth || b.ordinal - a.ordinal);
          return {
            slug: application.slug,
            name: application.name,
            team: application.team,
            tier: application.tier,
            affectedReleasesReached: routes.length,
            best: routes[0] ?? null,
          };
        })
        .sort(
          (a, b) =>
            (a.affectedReleasesReached === 0 ? 1 : 0) - (b.affectedReleasesReached === 0 ? 1 : 0) ||
            ((a.best?.route?.depth ?? 99) - (b.best?.route?.depth ?? 99)) ||
            a.name.localeCompare(b.name),
        );
    }

    case 'Cut points': {
      const versionKeys = graph.affectedByAdvisory.get(String(params.advisoryId)) ?? [];
      const grouped = new Map<
        string,
        {
          entry: { name: string; ecosystem: string; version: string; key: string };
          apps: Map<string, { slug: string; name: string; depth: number }>;
        }
      >();
      for (const application of data.applications) {
        let best: NonNullable<ReturnType<typeof graph.shortestRoute>> | null = null;
        for (const key of versionKeys) {
          const route = graph.shortestRoute(application.slug, key, PATH_DEPTH);
          if (route && (!best || route.depth < best.depth)) best = route;
        }
        if (!best) continue;
        for (const hop of best.hops.slice(0, -1)) {
          const bucket = grouped.get(hop.key) ?? {
            entry: { name: hop.name, ecosystem: hop.ecosystem, version: hop.version, key: hop.key },
            apps: new Map(),
          };
          bucket.apps.set(application.slug, {
            slug: application.slug,
            name: application.name,
            depth: best.depth,
          });
          grouped.set(hop.key, bucket);
        }
      }
      return [...grouped.values()]
        .map((bucket) => ({
          packageName: bucket.entry.name,
          ecosystem: bucket.entry.ecosystem,
          version: bucket.entry.version,
          versionKey: bucket.entry.key,
          applications: [...bucket.apps.values()],
          applicationCount: bucket.apps.size,
        }))
        .sort((a, b) => b.applicationCount - a.applicationCount || a.packageName.localeCompare(b.packageName))
        .slice(0, Number(params.limit ?? 12));
    }

    case 'Application profile': {
      const application = graph.appBySlug.get(String(params.slug));
      if (!application) return [];
      const cumulative = [1, 2, 3, 4, 5, 6].map((depth) => graph.reach(application.slug, depth).size);
      const newAtDepth = cumulative.map((value, index) => value - (index === 0 ? 0 : (cumulative[index - 1] ?? 0)));
      return [
        {
          slug: application.slug,
          name: application.name,
          team: application.team,
          tier: application.tier,
          runtime: application.runtime,
          purpose: application.purpose,
          firstShipped: application.firstShipped,
          newAtDepth,
          totalReach: cumulative[5] ?? 0,
        },
      ];
    }

    case 'Declared dependencies': {
      const edges = graph.appEdges.get(String(params.slug)) ?? [];
      return edges
        .map((edge) => {
          const version = graph.versionByKey.get(edge.to);
          if (!version) return null;
          const pkg = graph.packageByKey.get(`${version.ecosystem}:${version.name}`);
          const spdx = graph.licenceByVersion.get(version.key) ?? null;
          const licence = spdx ? graph.licenceById.get(spdx) : null;
          const advisories = graph.advisoriesByVersion.get(version.key) ?? [];
          return {
            key: version.key,
            name: version.name,
            version: version.version,
            ecosystem: version.ecosystem,
            scope: edge.scope,
            range: edge.range,
            role: pkg?.role ?? '',
            license: spdx,
            licenseCategory: licence?.category ?? null,
            advisoryCount: advisories.length,
            severities: advisories.map((id) => graph.advisoryById.get(id)?.severity ?? 'low'),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => b.advisoryCount - a.advisoryCount || a.name.localeCompare(b.name));
    }

    case 'Reachable advisories': {
      const slug = String(params.slug);
      const out: Fields[] = [];
      for (const advisory of data.advisories) {
        const versionKeys = graph.affectedByAdvisory.get(advisory.id) ?? [];
        let best: { route: NonNullable<ReturnType<typeof graph.shortestRoute>>; key: string } | null = null;
        for (const key of versionKeys) {
          const route = graph.shortestRoute(slug, key, PATH_DEPTH);
          if (route && (!best || route.depth < best.route.depth)) best = { route, key };
        }
        if (!best) continue;
        const version = graph.versionByKey.get(best.key);
        const edge = data.affects.find((item) => item.advisoryId === advisory.id);
        out.push({
          id: advisory.id,
          title: advisory.title,
          severity: advisory.severity,
          score: advisory.score,
          best: {
            route: routeShape(best.route),
            packageName: version?.name ?? '',
            ecosystem: version?.ecosystem ?? 'npm',
            version: version?.version ?? '',
            fixedIn: edge?.fixedIn ?? null,
          },
        });
      }
      return out.sort((a, b) => (b.score as number) - (a.score as number) || String(a.id).localeCompare(String(b.id)));
    }

    case 'Reciprocal licence exposure': {
      const slug = String(params.slug);
      const reach = graph.reach(slug, PATH_DEPTH);
      const buckets = new Map<string, { packages: Set<string>; nearest: { depth: number; key: string } | null }>();
      for (const [versionKey] of reach) {
        const spdx = graph.licenceByVersion.get(versionKey);
        if (!spdx) continue;
        const licence = graph.licenceById.get(spdx);
        if (!licence || !RECIPROCAL_CATEGORIES.includes(licence.category)) continue;
        const version = graph.versionByKey.get(versionKey);
        if (!version) continue;
        const bucket = buckets.get(spdx) ?? { packages: new Set<string>(), nearest: null };
        bucket.packages.add(version.name);
        const depth = reach.get(versionKey) ?? 99;
        if (!bucket.nearest || depth < bucket.nearest.depth) bucket.nearest = { depth, key: versionKey };
        buckets.set(spdx, bucket);
      }
      const order: Record<string, number> = { 'network-copyleft': 0, 'strong-copyleft': 1 };
      return [...buckets.entries()]
        .map(([spdx, bucket]) => {
          const licence = graph.licenceById.get(spdx);
          const nearestVersion = bucket.nearest ? graph.versionByKey.get(bucket.nearest.key) : null;
          const route = bucket.nearest ? graph.shortestRoute(slug, bucket.nearest.key, PATH_DEPTH) : null;
          return {
            spdxId: spdx,
            licenseName: licence?.name ?? spdx,
            category: licence?.category ?? 'permissive',
            note: licence?.note ?? '',
            packagesReached: bucket.packages.size,
            nearest: route
              ? { route: routeShape(route), packageName: nearestVersion?.name ?? '', version: nearestVersion?.version ?? '' }
              : null,
          };
        })
        .sort(
          (a, b) =>
            (order[a.category] ?? 2) - (order[b.category] ?? 2) || b.packagesReached - a.packagesReached,
        );
    }

    case 'Package record': {
      const pkg = graph.packageByKey.get(String(params.key));
      if (!pkg) return [];
      const supersession = data.supersessions.find((item) => item.from === pkg.key);
      const replacement = supersession ? graph.packageByKey.get(supersession.to) : null;
      return [
        {
          key: pkg.key,
          name: pkg.name,
          ecosystem: pkg.ecosystem,
          role: pkg.role,
          weeklyDownloads: pkg.weeklyDownloads,
          deprecated: pkg.deprecated,
          supersededBy:
            supersession && replacement
              ? { key: replacement.key, name: replacement.name, reason: supersession.reason }
              : null,
          maintainers: (graph.maintainersByPackage.get(pkg.key) ?? []).map((handle) => {
            const person = graph.maintainerByHandle.get(handle);
            const edge = data.maintenance.find((item) => item.packageKey === pkg.key && item.handle === handle);
            return {
              handle,
              name: person?.name ?? handle,
              twoFactorEnabled: person?.twoFactorEnabled ?? false,
              affiliation: person?.affiliation ?? null,
              role: edge?.role ?? 'publisher',
            };
          }),
          releases: (graph.versionsByPackage.get(pkg.key) ?? []).map((version) => {
            const spdx = graph.licenceByVersion.get(version.key) ?? null;
            return {
              key: version.key,
              version: version.version,
              ordinal: version.ordinal,
              published: version.published,
              license: spdx,
              licenseCategory: spdx ? (graph.licenceById.get(spdx)?.category ?? null) : null,
              advisories: (graph.advisoriesByVersion.get(version.key) ?? []).map((id) => ({
                id,
                severity: graph.advisoryById.get(id)?.severity ?? 'low',
              })),
            };
          }),
        },
      ];
    }

    case 'Package reach': {
      const pkg = graph.packageByKey.get(String(params.key));
      if (!pkg) return [{ reachedApplications: [], directDependents: [], directDependentCount: 0 }];
      const releases = graph.versionsByPackage.get(pkg.key) ?? [];
      const reachedApplications = data.applications
        .map((application) => {
          let best: NonNullable<ReturnType<typeof graph.shortestRoute>> | null = null;
          for (const release of releases) {
            const route = graph.shortestRoute(application.slug, release.key, PATH_DEPTH);
            if (route && (!best || route.depth < best.depth)) best = route;
          }
          return best
            ? { slug: application.slug, name: application.name, team: application.team, route: routeShape(best) }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      const dependents = new Map<string, Fields>();
      for (const release of releases) {
        for (const edge of graph.incoming.get(release.key) ?? []) {
          const source = graph.versionByKey.get(edge.from);
          if (source && !dependents.has(source.key)) {
            dependents.set(source.key, {
              key: source.key,
              name: source.name,
              version: source.version,
              ecosystem: source.ecosystem,
            });
          }
        }
      }
      const all = [...dependents.values()];
      return [
        {
          reachedApplications,
          directDependents: all.slice(0, Number(params.dependentLimit ?? 40)),
          directDependentCount: all.length,
        },
      ];
    }

    case 'Load-bearing packages': {
      const counts = new Map<string, Set<string>>();
      for (const application of data.applications) {
        for (const versionKey of graph.reach(application.slug, REACH_DEPTH).keys()) {
          const packageKey = graph.packageOf(versionKey);
          const set = counts.get(packageKey) ?? new Set<string>();
          set.add(application.slug);
          counts.set(packageKey, set);
        }
      }
      return [...counts.entries()]
        .map(([key, apps]) => {
          const pkg = graph.packageByKey.get(key);
          return {
            key,
            name: pkg?.name ?? key,
            ecosystem: pkg?.ecosystem ?? 'npm',
            role: pkg?.role ?? '',
            weeklyDownloads: pkg?.weeklyDownloads ?? 0,
            applicationsReached: apps.size,
            maintainerCount: (graph.maintainersByPackage.get(key) ?? []).length,
          };
        })
        .sort(
          (a, b) =>
            b.applicationsReached - a.applicationsReached ||
            a.maintainerCount - b.maintainerCount ||
            a.name.localeCompare(b.name),
        )
        .slice(0, Number(params.limit ?? 12));
    }

    case 'Maintainer chokepoints': {
      const rows: Fields[] = [];
      for (const [handle, packageKeys] of graph.packagesByMaintainer) {
        const person = graph.maintainerByHandle.get(handle);
        if (!person || person.twoFactorEnabled) continue;
        const sole = packageKeys.filter((key) => (graph.maintainersByPackage.get(key) ?? []).length === 1);
        if (sole.length === 0) continue;
        const apps = new Set<string>();
        for (const application of data.applications) {
          const reach = graph.reach(application.slug, REACH_DEPTH);
          for (const versionKey of reach.keys()) {
            if (sole.includes(graph.packageOf(versionKey))) {
              apps.add(application.name);
              break;
            }
          }
        }
        rows.push({
          handle,
          name: person.name,
          affiliation: person.affiliation,
          joined: person.joined,
          packages: sole.map((key) => {
            const pkg = graph.packageByKey.get(key);
            return { key, name: pkg?.name ?? key, ecosystem: pkg?.ecosystem ?? 'npm' };
          }),
          applications: [...apps],
          packageCount: sole.length,
          applicationCount: apps.size,
        });
      }
      return rows
        .sort(
          (a, b) =>
            (b.applicationCount as number) - (a.applicationCount as number) ||
            (b.packageCount as number) - (a.packageCount as number) ||
            String(a.name).localeCompare(String(b.name)),
        )
        .slice(0, Number(params.limit ?? 8));
    }

    case 'Maintainer profile': {
      const person = graph.maintainerByHandle.get(String(params.handle));
      if (!person) return [];
      const owned = graph.packagesByMaintainer.get(person.handle) ?? [];
      const reach = data.applications
        .map((application) => {
          let best: NonNullable<ReturnType<typeof graph.shortestRoute>> | null = null;
          for (const packageKey of owned) {
            for (const release of graph.versionsByPackage.get(packageKey) ?? []) {
              const route = graph.shortestRoute(application.slug, release.key, PATH_DEPTH);
              if (route && (!best || route.depth < best.depth)) best = route;
            }
          }
          return best
            ? { slug: application.slug, name: application.name, team: application.team, route: routeShape(best) }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
      return [
        {
          handle: person.handle,
          name: person.name,
          affiliation: person.affiliation,
          joined: person.joined,
          twoFactorEnabled: person.twoFactorEnabled,
          packages: owned.map((key) => {
            const pkg = graph.packageByKey.get(key);
            return {
              key,
              name: pkg?.name ?? key,
              ecosystem: pkg?.ecosystem ?? 'npm',
              role: pkg?.role ?? '',
              weeklyDownloads: pkg?.weeklyDownloads ?? 0,
              soleMaintainer: (graph.maintainersByPackage.get(key) ?? []).length === 1,
            };
          }),
          reach,
        },
      ];
    }

    case 'Route trace': {
      const slug = String(params.slug);
      const application = graph.appBySlug.get(slug);
      const pkg = graph.packageByKey.get(String(params.packageKey));
      if (!application || !pkg) return [];
      const routes = (graph.versionsByPackage.get(pkg.key) ?? [])
        .map((release) => {
          const route = graph.shortestRoute(slug, release.key, PATH_DEPTH);
          return route
            ? {
                target: { key: release.key, version: release.version, published: release.published },
                route: routeShape(route),
                ordinal: release.ordinal,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => a.route!.depth - b.route!.depth || b.ordinal - a.ordinal);
      return [
        {
          slug: application.slug,
          applicationName: application.name,
          team: application.team,
          packageKey: pkg.key,
          packageName: pkg.name,
          ecosystem: pkg.ecosystem,
          role: pkg.role,
          routes,
        },
      ];
    }

    case 'Alternate routes': {
      const routes = graph.allShortestRoutes(
        String(params.slug),
        String(params.versionKey),
        PATH_DEPTH,
        Number(params.limit ?? 8),
      );
      return [{ total: routes.length, routes: routes.map(routeShape) }];
    }

    case 'Reachable packages': {
      const slug = String(params.slug);
      const search = String(params.search ?? '');
      const reach = graph.reach(slug, PATH_DEPTH);
      const best = new Map<string, number>();
      for (const [versionKey, depth] of reach) {
        const packageKey = graph.packageOf(versionKey);
        const current = best.get(packageKey);
        if (current === undefined || depth < current) best.set(packageKey, depth);
      }
      return [...best.entries()]
        .map(([key, depth]) => {
          const pkg = graph.packageByKey.get(key);
          return { key, name: pkg?.name ?? key, ecosystem: pkg?.ecosystem ?? 'npm', role: pkg?.role ?? '', depth };
        })
        .filter((row) => search === '' || row.name.toLowerCase().includes(search))
        .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
        .slice(0, Number(params.limit ?? 40));
    }

    case 'Search': {
      const needle = String(params.needle ?? '');
      const perKind = Number(params.perKind ?? 6);
      const hits: Fields[] = [];
      hits.push(
        ...data.applications
          .filter((item) => item.name.toLowerCase().includes(needle) || item.team.toLowerCase().includes(needle))
          .slice(0, perKind)
          .map((item) => ({ kind: 'application', label: item.name, id: item.slug, detail: item.team })),
      );
      hits.push(
        ...data.packages
          .filter((item) => item.name.toLowerCase().includes(needle))
          .slice(0, perKind)
          .map((item) => ({ kind: 'package', label: item.name, id: item.key, detail: item.role })),
      );
      hits.push(
        ...data.advisories
          .filter(
            (item) =>
              item.id.toLowerCase().includes(needle) ||
              item.title.toLowerCase().includes(needle) ||
              item.weakness.toLowerCase().includes(needle),
          )
          .slice(0, perKind)
          .map((item) => ({ kind: 'advisory', label: item.title, id: item.id, detail: item.severity })),
      );
      hits.push(
        ...data.maintainers
          .filter((item) => item.name.toLowerCase().includes(needle) || item.handle.toLowerCase().includes(needle))
          .slice(0, perKind)
          .map((item) => ({
            kind: 'maintainer',
            label: item.name,
            id: item.handle,
            detail: item.affiliation ?? 'Unaffiliated',
          })),
      );
      return hits;
    }

    default:
      throw new Error(`No fixture for query "${name}". Add one in src/lib/neo4j.fixture.ts.`);
  }
}
/* eslint-enable complexity */

export async function read<TParams extends Record<string, unknown>, TResult>(
  query: ReadQuery<TParams, TResult>,
): Promise<Outcome<TResult>> {
  const startedAt = Date.now();
  const rows = rowsFor(query.name, query.params);
  // A little latency so loading states are visible when the fixtures are used
  // to review the interface.
  await new Promise((resolve) => setTimeout(resolve, 4));
  const meta: QueryMeta = {
    name: query.name,
    purpose: query.purpose,
    cypher: query.cypher.trim(),
    params: query.params,
    elapsedMs: Date.now() - startedAt,
    records: rows.length,
  };
  return { ok: true, data: query.map(rows.map(record)), meta };
}

export async function checkHealth(): Promise<Health> {
  return { status: 'ok', latencyMs: 3, address: null, version: 'fixtures' };
}

export function getDriver(): never {
  throw new Error('The fixture module has no driver. Unset UNDERSTORY_FIXTURES to use Bolt.');
}

export async function closeDriver(): Promise<void> {
  /* nothing to close */
}

export type { Health, ReadQuery };
export { SEVERITY_RANK };
export type { Severity };
