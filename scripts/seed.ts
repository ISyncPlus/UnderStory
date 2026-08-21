import neo4j, { type Driver, type Session } from 'neo4j-driver';

import { buildGraph } from '../src/data/build-graph';
import {
  COUNT_NODES,
  COUNT_RELATIONSHIPS,
  CONSTRAINTS,
  DELETE_BATCH,
  INDEXES,
  WRITES,
} from '../src/data/schema';
import { loadEnv } from './load-env';

loadEnv();

const BATCH_SIZE = 400;

const styles = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string, hint?: string): never {
  process.stderr.write(`\n${styles.red}${styles.bold}✗ ${message}${styles.reset}\n`);
  if (hint) process.stderr.write(`${styles.dim}  ${hint}${styles.reset}\n`);
  process.stderr.write('\n');
  process.exit(1);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function runBatched(
  session: Session,
  label: string,
  cypher: string,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    log(`  ${styles.dim}${label.padEnd(26)} —${styles.reset}`);
    return;
  }
  const batches = chunk(rows, BATCH_SIZE);
  let written = 0;
  for (const batch of batches) {
    await session.executeWrite((tx) => tx.run(cypher, { rows: batch }));
    written += batch.length;
    process.stdout.write(
      `\r  ${label.padEnd(26)} ${styles.cyan}${written}/${rows.length}${styles.reset}   `,
    );
  }
  process.stdout.write(`\r  ${label.padEnd(26)} ${styles.green}${rows.length}${styles.reset}          \n`);
}

async function resetGraph(session: Session): Promise<void> {
  log(`\n${styles.yellow}Deleting the existing graph…${styles.reset}`);
  let total = 0;
  for (;;) {
    const result = await session.executeWrite((tx) => tx.run(DELETE_BATCH, { batchSize: 2000 }));
    const deleted = Number(result.records[0]?.get('deleted') ?? 0);
    total += deleted;
    if (deleted === 0) break;
    process.stdout.write(`\r  deleted ${total} nodes   `);
  }
  process.stdout.write(`\r  ${styles.green}deleted ${total} nodes${styles.reset}          \n`);
}

async function applySchema(session: Session): Promise<void> {
  log(`\n${styles.bold}Schema${styles.reset}`);
  for (const statement of [...CONSTRAINTS, ...INDEXES]) {
    const name = statement.match(/(?:CONSTRAINT|INDEX)\s+(\w+)/)?.[1] ?? 'statement';
    try {
      await session.executeWrite((tx) => tx.run(statement));
      log(`  ${styles.green}✓${styles.reset} ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  ${styles.yellow}!${styles.reset} ${name} ${styles.dim}— skipped: ${message}${styles.reset}`);
    }
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const reset = args.has('--reset');

  log(`\n${styles.bold}Understory — graph load${styles.reset}`);
  log(`${styles.dim}Building the dataset…${styles.reset}`);

  const graph = buildGraph();
  const { report } = graph;

  log(
    `  ${report.counts.nodes} nodes · ${report.counts.relationships} relationships ` +
      `${styles.dim}(seed ${report.seed}, ${report.retargets} resolution${report.retargets === 1 ? '' : 's'} pinned)${styles.reset}`,
  );
  log(
    `  ${styles.dim}depth spread: ${report.depthHistogram
      .map((bucket) => `${bucket.depth}→${bucket.pairs}`)
      .join('  ')}${styles.reset}`,
  );

  if (dryRun) {
    log(`\n${styles.green}Dataset builds and validates. Nothing was written (--dry-run).${styles.reset}\n`);
    return;
  }

  const uri = process.env.NEO4J_URI?.trim();
  const username = process.env.NEO4J_USERNAME?.trim() || 'cognodb';
  const password = process.env.NEO4J_PASSWORD?.trim();
  const database = process.env.NEO4J_DATABASE?.trim();

  if (!uri || /REPLACE_ME/i.test(uri) || !password || /REPLACE_ME/i.test(password)) {
    fail(
      'NEO4J_URI and NEO4J_PASSWORD are not set.',
      'Copy .env.example to .env.local and fill in the values from the CognoDB console. See docs/SETUP-COGNODB.md.',
    );
  }

  let driver: Driver;
  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      disableLosslessIntegers: true,
      connectionTimeout: 20_000,
      connectionAcquisitionTimeout: 30_000,
      maxTransactionRetryTime: 15_000,
      userAgent: 'understory-seed/1.0',
    });
    await driver.verifyConnectivity(database ? { database } : {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(
      'Could not reach the database.',
      `${message}\n  Check that the instance is running in the CognoDB console and that NEO4J_URI matches its bolt+s:// URI.`,
    );
  }

  const session = driver.session(database ? { database } : {});

  try {
    if (reset) await resetGraph(session);

    await applySchema(session);

    log(`\n${styles.bold}Nodes${styles.reset}`);
    await runBatched(session, 'Application', WRITES.applications, graph.applications);
    await runBatched(session, 'License', WRITES.licenses, graph.licenses);
    await runBatched(session, 'Maintainer', WRITES.maintainers, graph.maintainers);
    await runBatched(session, 'Package', WRITES.packages, graph.packages);
    await runBatched(session, 'Advisory', WRITES.advisories, graph.advisories);
    await runBatched(
      session,
      'PackageVersion',
      WRITES.versions,
      graph.versions.map((version) => ({
        ...version,
        packageKey: `${version.ecosystem}:${version.name}`,
      })),
    );

    log(`\n${styles.bold}Relationships${styles.reset}`);
    await runBatched(session, 'LICENSED_UNDER', WRITES.licensing, graph.licensing);
    await runBatched(session, 'MAINTAINED_BY', WRITES.maintenance, graph.maintenance);
    await runBatched(session, 'DEPENDS_ON (direct)', WRITES.applicationDependencies, graph.applicationDependencies);
    await runBatched(session, 'DEPENDS_ON (transitive)', WRITES.versionDependencies, graph.versionDependencies);
    await runBatched(session, 'AFFECTS', WRITES.affects, graph.affects);
    await runBatched(session, 'SUPERSEDED_BY', WRITES.supersessions, graph.supersessions);

    const nodeCount = await session.executeRead((tx) => tx.run(COUNT_NODES));
    const relCount = await session.executeRead((tx) => tx.run(COUNT_RELATIONSHIPS));

    log(`\n${styles.green}${styles.bold}✓ Loaded.${styles.reset}`);
    log(
      `  The instance now holds ${styles.bold}${nodeCount.records[0]?.get('total')}${styles.reset} nodes and ` +
        `${styles.bold}${relCount.records[0]?.get('total')}${styles.reset} relationships.`,
    );
    log(`\n  ${styles.dim}Start the app with${styles.reset} npm run dev\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail('The load failed part-way through.', `${message}\n  Re-running is safe: every statement merges on a natural key.`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail('Unexpected failure.', message);
});
