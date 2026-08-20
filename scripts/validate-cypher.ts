/**
 * Static check over every Cypher statement in the repository.
 *
 *   npm run cypher:check
 *
 * Two things are verified, and both are things a code review would otherwise
 * have to catch by eye:
 *
 * 1. **Syntax.** Each statement is parsed with `@neo4j-cypher/language-support`,
 *    the same ANTLR grammar Neo4j's own editor tooling uses. A typo fails the
 *    check instead of failing at request time in front of a reviewer.
 *
 * 2. **No interpolated values.** Every interpolation inside a Cypher template
 *    literal must name one of a small allowlist of structural constants: the
 *    traversal bounds, which Cypher does not accept as parameters, and the
 *    shared route projection. Anything else would be a value concatenated into
 *    a query, which this project does not do.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { validateSyntax } from '@neo4j-cypher/language-support';

import { PATH_DEPTH, REACH_DEPTH, ROUTE_PROJECTION } from '../src/data/queries/shared';
import {
  CONSTRAINTS,
  COUNT_NODES,
  COUNT_RELATIONSHIPS,
  DELETE_BATCH,
  INDEXES,
  WRITES,
} from '../src/data/schema';
import { style } from './style';

const ALLOWED_INTERPOLATIONS: Record<string, string> = {
  PATH_DEPTH: String(PATH_DEPTH),
  REACH_DEPTH: String(REACH_DEPTH),
  ROUTE_PROJECTION,
};

/** Guard against the scanner silently breaking and reporting a clean run over nothing. */
const MINIMUM_SCANNED_QUERIES = 15;

type Statement = { source: string; label: string; cypher: string };

/** This file describes the extraction pattern in its own source; scanning it would match itself. */
const SELF = 'validate-cypher.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === SELF || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Pulls every `cypher:` template literal out of a source file. */
function extractFromSource(file: string): { statements: Statement[]; violations: string[] } {
  const source = readFileSync(file, 'utf8');
  const statements: Statement[] = [];
  const violations: string[] = [];
  const relativePath = relative(process.cwd(), file);

  const pattern = /cypher:\s*`([\s\S]*?)`(?=,\s*\n)/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(source)) !== null) {
    index += 1;
    const raw = match[1] ?? '';
    const before = source.slice(0, match.index);
    const nameMatch = /name:\s*'([^']+)',[^`]*$/.exec(before);
    const label = nameMatch?.[1] ?? `statement ${index}`;

    const resolved = raw.replace(/\$\{([^}]*)\}/g, (_whole, expression: string) => {
      const key = expression.trim();
      const replacement = ALLOWED_INTERPOLATIONS[key];
      if (replacement === undefined) {
        violations.push(
          `${relativePath} - "${label}" interpolates ${key}, which is not a structural constant. ` +
            'Values must travel as parameters.',
        );
        return '0';
      }
      return replacement;
    });

    statements.push({ source: relativePath, label, cypher: resolved });
  }

  return { statements, violations };
}

function main(): void {
  process.stdout.write(`\n${style.bold('Understory - Cypher check')}\n\n`);

  const files = [...walk(join(process.cwd(), 'src')), ...walk(join(process.cwd(), 'scripts'))];
  const statements: Statement[] = [];
  const violations: string[] = [];

  for (const file of files) {
    const result = extractFromSource(file);
    statements.push(...result.statements);
    violations.push(...result.violations);
  }

  const scanned = statements.length;

  for (const [label, cypher] of Object.entries(WRITES)) {
    statements.push({ source: 'src/data/schema.ts', label: `write - ${label}`, cypher });
  }
  for (const cypher of [...CONSTRAINTS, ...INDEXES]) {
    statements.push({
      source: 'src/data/schema.ts',
      label: `schema - ${cypher.match(/(?:CONSTRAINT|INDEX)\s+(\w+)/)?.[1] ?? cypher.slice(0, 40)}`,
      cypher,
    });
  }
  statements.push({ source: 'src/data/schema.ts', label: 'maintenance - delete batch', cypher: DELETE_BATCH });
  statements.push({ source: 'src/data/schema.ts', label: 'maintenance - count nodes', cypher: COUNT_NODES });
  statements.push({
    source: 'src/data/schema.ts',
    label: 'maintenance - count relationships',
    cypher: COUNT_RELATIONSHIPS,
  });

  let failures = 0;
  let lastSource = '';

  for (const statement of statements) {
    if (statement.source !== lastSource) {
      process.stdout.write(`  ${style.dim(statement.source)}\n`);
      lastSource = statement.source;
    }
    const diagnostics = validateSyntax(statement.cypher, {});
    if (diagnostics.length === 0) {
      process.stdout.write(`    ${style.green('ok')}   ${statement.label}\n`);
      continue;
    }

    failures += 1;
    process.stdout.write(`    ${style.red('FAIL')} ${statement.label}\n`);
    const lines = statement.cypher.split('\n');
    for (const diagnostic of diagnostics) {
      const line = diagnostic.range?.start?.line ?? 0;
      process.stdout.write(`      ${style.red(`line ${line + 1}: ${diagnostic.message}`)}\n`);
      for (let i = Math.max(0, line - 2); i <= Math.min(lines.length - 1, line + 1); i += 1) {
        process.stdout.write(`      ${style.dim(`${String(i + 1).padStart(3)} | ${lines[i]}`)}\n`);
      }
    }
  }

  process.stdout.write('\n');

  if (scanned < MINIMUM_SCANNED_QUERIES) {
    process.stdout.write(
      style.red(
        `Only ${scanned} query template(s) were found by the scanner; expected at least ` +
          `${MINIMUM_SCANNED_QUERIES}. The extractor is out of step with the source format.`,
      ) + '\n\n',
    );
    process.exit(1);
  }

  if (violations.length > 0) {
    process.stdout.write(`${style.bold(style.red('Interpolation violations'))}\n`);
    for (const violation of violations) process.stdout.write(`  ${style.red(violation)}\n`);
    process.stdout.write('\n');
  }

  if (failures > 0 || violations.length > 0) {
    process.stdout.write(
      style.red(
        `${failures} statement(s) failed to parse, ${violations.length} interpolation violation(s).`,
      ) + '\n\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `${style.green(style.bold(`${statements.length} statements parse cleanly.`))} ` +
      style.dim(
        `${scanned} from query modules, ${statements.length - scanned} from the schema. No interpolated values.`,
      ) +
      '\n\n',
  );
}

main();
