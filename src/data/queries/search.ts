import 'server-only';

import type { Outcome } from '@/lib/errors';
import { read } from '@/lib/neo4j';

import { asString } from './shared';

export type SearchHit = {
  kind: 'application' | 'package' | 'advisory' | 'maintainer';
  label: string;
  id: string;
  detail: string;
};

/** Cross-label search. */
export function search(term: string, perKind = 6): Promise<Outcome<SearchHit[]>> {
  const needle = term.trim().toLowerCase();
  return read({
    name: 'Search',
    purpose: 'Matches a typed term against application names, package names, advisory identifiers and maintainer handles.',
    cypher: `
      MATCH (application:Application)
      WHERE toLower(application.name) CONTAINS $needle OR toLower(application.team) CONTAINS $needle
      RETURN 'application' AS kind,
             application.name AS label,
             application.slug AS id,
             application.team AS detail
      ORDER BY label ASC
      LIMIT $perKind

      UNION

      MATCH (package:Package)
      WHERE toLower(package.name) CONTAINS $needle
      RETURN 'package' AS kind,
             package.name AS label,
             package.key AS id,
             package.role AS detail
      ORDER BY label ASC
      LIMIT $perKind

      UNION

      MATCH (advisory:Advisory)
      WHERE toLower(advisory.id) CONTAINS $needle
         OR toLower(advisory.title) CONTAINS $needle
         OR toLower(advisory.weakness) CONTAINS $needle
      RETURN 'advisory' AS kind,
             advisory.title AS label,
             advisory.id AS id,
             advisory.severity AS detail
      ORDER BY label ASC
      LIMIT $perKind

      UNION

      MATCH (maintainer:Maintainer)
      WHERE toLower(maintainer.name) CONTAINS $needle OR toLower(maintainer.handle) CONTAINS $needle
      RETURN 'maintainer' AS kind,
             maintainer.name AS label,
             maintainer.handle AS id,
             coalesce(maintainer.affiliation, 'Unaffiliated') AS detail
      ORDER BY label ASC
      LIMIT $perKind
    `,
    params: { needle, perKind },
    map: (records) => {
      const hits = records.map((record) => ({
        kind: asString(record.get('kind')) as SearchHit['kind'],
        label: asString(record.get('label')),
        id: asString(record.get('id')),
        detail: asString(record.get('detail')),
      }));

      const rank = (hit: SearchHit): number => {
        const label = hit.label.toLowerCase();
        const id = hit.id.toLowerCase();
        if (label.startsWith(needle) || id.startsWith(needle)) return 0;
        return 1;
      };
      return hits.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
    },
  });
}
