import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PATH_DEPTH, REACH_DEPTH, ROUTE_PROJECTION } from '../src/data/queries/shared';
import { style } from './style';

const SUBSTITUTIONS: Record<string, string> = {
  PATH_DEPTH: String(PATH_DEPTH),
  REACH_DEPTH: String(REACH_DEPTH),
  ROUTE_PROJECTION,
};

/** Hand-written commentary, keyed by the query's `name`. */
const NOTES: Record<string, string> = {
  'Blast radius':
    'The headline traversal, and the reason the product exists. `OPTIONAL MATCH` keeps the unexposed applications in the result: *not reached* is an answer a reader needs, and dropping those rows would quietly turn "nine of twelve" into "nine". `collect()` discards nulls, so the `CASE` yields only real routes while the row survives.\n\n`shortestPath` with both endpoints bound is a bidirectional breadth-first search. Its cost is a function of the graph, not of how many distinct routes exist between the two nodes — and between an application and a leaf utility, that number is combinatorial. A plain `MATCH (a)-[:DEPENDS_ON*1..8]->(b)` would try to enumerate all of them.',
  'Cut points':
    '`nodes(shortest)[1..-1]` is the whole idea in one expression: index 0 is the application and the last element is the flawed release, so the slice is exactly the hops in between. Counting how many shortest paths pass through each of those hops turns "nine applications are exposed" into "changing this one package removes four of them".\n\nApplications whose path is a single hop have no intermediate at all — they declare the flawed release directly. The slice is empty, `UNWIND` drops the row, and the interface reports them separately rather than pretending there is something in between.',
  'Maintainer chokepoints':
    'The query a relational schema handles worst, and the one with no advisory behind it. A maintainer who is the *only* account able to publish a package, with no second factor, is a live risk to everything downstream — and nothing in a vulnerability feed describes it.\n\nTwo deliberate bounds keep it honest on a 0.5 vCPU instance. Candidates are ranked by how load-bearing their packages are and cut to `$candidateLimit` **before** the traversal runs, and the traversal itself stops at six hops. `WITH DISTINCT` immediately after the expansion is what lets an engine with pruning expansion skip duplicate paths rather than enumerate them.',
  'Reciprocal licence exposure':
    "An application's own licence is a single field. Whether it is *compatible* with what it ships is a property of everything beneath it, and the useful answer is not \"you have an AGPL dependency\" but \"here is the four-hop chain that introduced it, and here is the hop you would have to change\".\n\nThe ordering is deliberate: network-copyleft first, then strong, then weak — the order in which the obligations actually bite for a hosted service.",
  'Advisory reach':
    'Read it right to left. Binding the ~78 affected releases first means the variable-length expansion starts from a small set and walks *backwards* up the dependency edges, rather than fanning out from twelve applications across the whole registry. Expanding from the small side is the difference between seventy-eight breadth-first walks and twelve full sweeps.',
  'Application profile':
    'Six bounded expansions from a single node, rather than one unbounded walk that measures path lengths. Each `count(DISTINCT …)` is a set question — "how many releases are within N hops?" — so a planner with pruning expansion answers it without materialising a single path, and the differences between the cumulative counts give the number of releases that first appear at each depth.',
  'Alternate routes':
    '`allShortestPaths` returns the full set of minimum-length paths, which is how you discover that a dependency arrives through four different top-level packages rather than one — and therefore that removing any single one of them changes nothing.',
  'Estate inventory':
    'Each `MATCH … WITH count(…)` reduces to a single row before the next label scan begins, so the chain never builds a cross product. Six counts, one round trip.',
  'Search':
    'Four `UNION` arms rather than one clever pattern, because the four labels have nothing structurally in common — they are alike only in that a person might type any of their names. Each arm carries its own `LIMIT` so a broad term cannot let one label crowd out the others. `CONTAINS` on a lower-cased property is a scan rather than an index seek; at a few thousand nodes that is the right trade against provisioning a full-text index and taking on a dialect risk.',
  'Package reach':
    'The two halves answer different questions. "Which applications reach it" needs the whole path, so it uses `shortestPath` per (application, release) pair. "Who depends on it directly" is a single-hop reverse expansion — the question a package maintainer actually asks.',
  'Load-bearing packages':
    'Note what this is *not*: a popularity ranking. Download counts describe the ecosystem; this describes the estate. A package with a tenth of the downloads can sit under twice as many of your applications.',
  'Route trace':
    'One shortest chain per reachable release, so a reader can see that two different releases of the same package arrived by two different routes. That is the answer people actually want, and the one a dependency *list* structurally cannot give: a list knows the package is there, not how it got there.',
};

type Extracted = { file: string; name: string; purpose: string; cypher: string };

function extract(): Extracted[] {
  const dir = join(process.cwd(), 'src/data/queries');
  const out: Extracted[] = [];

  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith('.ts') || entry === 'shared.ts') continue;
    const source = readFileSync(join(dir, entry), 'utf8');
    const pattern =
      /name:\s*'([^']+)',\s*\n\s*purpose:\s*\n?\s*'((?:[^'\\]|\\.)*)',\s*\n\s*cypher:\s*`([\s\S]*?)`(?=,\s*\n)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const cypher = (match[3] ?? '')
        .replace(/\$\{([^}]*)\}/g, (_whole, key: string) => SUBSTITUTIONS[key.trim()] ?? '?')
        .split('\n')
        .map((line) => line.replace(/^ {6}/, ''))
        .join('\n')
        .trim();
      out.push({
        file: `src/data/queries/${entry}`,
        name: match[1] ?? '',
        purpose: (match[2] ?? '').replace(/\\u2019/g, '’').replace(/\\u2014/g, '—').replace(/\\'/g, "'"),
        cypher,
      });
    }
  }
  return out;
}

function main(): void {
  const queries = extract();
  const lines: string[] = [];

  lines.push('# The queries');
  lines.push('');
  lines.push('<!-- Generated by `npm run docs:queries`. The Cypher is read out of');
  lines.push('     src/data/queries/ rather than retyped, so it cannot drift from what runs. -->');
  lines.push('');
  lines.push(
    `Every read query in the application: **${queries.length} statements** across ` +
      `${new Set(queries.map((q) => q.file)).size} modules. Each carries the purpose string the ` +
      'interface displays in its own "Show the queries" disclosure, so what is documented here is ' +
      'exactly what a visitor can read on the page.',
  );
  lines.push('');
  lines.push('**Two conventions hold throughout:**');
  lines.push('');
  lines.push('- Every *value* travels as a parameter. The only things interpolated into a query are');
  lines.push(`  the traversal bounds (\`PATH_DEPTH = ${PATH_DEPTH}\`, \`REACH_DEPTH = ${REACH_DEPTH}\`) —`);
  lines.push('  Cypher does not accept a parameter for a variable-length bound — and a shared route');
  lines.push('  projection. `npm run cypher:check` fails the build on anything else.');
  lines.push('- Two bounds, for two shapes of query. `shortestPath` (8 hops) has both endpoints bound,');
  lines.push('  so it is a bidirectional breadth-first search whose cost follows the graph rather than');
  lines.push('  the number of routes. Set traversals (6 hops) are always written with `DISTINCT`');
  lines.push('  immediately after the expansion, so an engine with pruning expansion can skip');
  lines.push('  duplicate paths instead of enumerating them.');
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  for (const query of queries) {
    const slug = query.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    lines.push(`- [${query.name}](#${slug}) — ${query.purpose}`);
  }
  lines.push('');

  let lastFile = '';
  for (const query of queries) {
    if (query.file !== lastFile) {
      lines.push('---');
      lines.push('');
      lines.push(`### \`${query.file}\``);
      lines.push('');
      lastFile = query.file;
    }
    lines.push(`## ${query.name}`);
    lines.push('');
    lines.push(`*${query.purpose}*`);
    lines.push('');
    lines.push('```cypher');
    lines.push(query.cypher);
    lines.push('```');
    lines.push('');
    const note = NOTES[query.name];
    if (note) {
      lines.push(note);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Write statements');
  lines.push('');
  lines.push('The seed script is the only thing in the repository that writes. Every statement takes');
  lines.push('a single `$rows` parameter and unwinds it — the same no-interpolation rule as the read');
  lines.push('path — and merges on a natural key, so running the seed twice produces the same graph');
  lines.push('rather than a doubled one. They live in [`src/data/schema.ts`](../src/data/schema.ts)');
  lines.push('alongside the six uniqueness constraints and six indexes.');
  lines.push('');

  writeFileSync(join(process.cwd(), 'docs/QUERIES.md'), lines.join('\n'));
  process.stdout.write(
    `\n${style.green(`docs/QUERIES.md written`)} ${style.dim(`${queries.length} queries documented`)}\n\n`,
  );
}

main();
