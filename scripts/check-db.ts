/**
 * Connectivity and data verification script for CognoDB.
 * Verifies environment config, connection handshake, and seeded graph contents.
 */
import neo4j from 'neo4j-driver';

import { loadEnv } from './load-env';

loadEnv();

const styles = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
};

function line(symbol: string, colour: string, label: string, detail?: string): void {
  process.stdout.write(`  ${colour}${symbol}${styles.reset} ${label}\n`);
  if (detail) process.stdout.write(`    ${styles.dim}${detail}${styles.reset}\n`);
}

async function main(): Promise<void> {
  process.stdout.write(`\n${styles.bold}Understory — connection check${styles.reset}\n\n`);

  const uri = process.env.NEO4J_URI?.trim();
  const username = process.env.NEO4J_USERNAME?.trim() || 'cognodb';
  const password = process.env.NEO4J_PASSWORD?.trim();
  const database = process.env.NEO4J_DATABASE?.trim();

  if (!uri || /REPLACE_ME/i.test(uri) || !password || /REPLACE_ME/i.test(password)) {
    line('✗', styles.red, 'Environment is not configured.', 'Copy .env.example to .env.local and fill in NEO4J_URI and NEO4J_PASSWORD.');
    process.stdout.write('\n');
    process.exit(1);
  }

  let host = uri;
  try {
    host = new URL(uri).host;
  } catch {
    /* keep the raw value */
  }
  line('✓', styles.green, 'Environment is configured.', `${username}@${host}`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    disableLosslessIntegers: true,
    connectionTimeout: 20_000,
    userAgent: 'understory-check/1.0',
  });

  const startedAt = Date.now();
  try {
    await driver.verifyConnectivity(database ? { database } : {});
    line('✓', styles.green, `Reachable and authenticated.`, `handshake in ${Date.now() - startedAt} ms`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const auth = /unauthorized|authentication/i.test(message);
    line(
      '✗',
      styles.red,
      auth ? 'Credentials were refused.' : 'Could not reach the instance.',
      auth
        ? 'The password is shown once at creation. Recreate the instance or rotate the password in the CognoDB console.'
        : message,
    );
    await driver.close();
    process.stdout.write('\n');
    process.exit(1);
  }

  try {
    const { records } = await driver.executeQuery(
      `
      MATCH (application:Application) WITH count(application) AS applications
      MATCH (package:Package) WITH applications, count(package) AS packages
      MATCH (version:PackageVersion) WITH applications, packages, count(version) AS versions
      MATCH (advisory:Advisory) WITH applications, packages, versions, count(advisory) AS advisories
      MATCH ()-[edge:DEPENDS_ON]->() 
      RETURN applications, packages, versions, advisories, count(edge) AS dependencies
      `,
      {},
      { routing: neo4j.routing.READ, ...(database ? { database } : {}) },
    );

    const row = records[0];
    const applications = Number(row?.get('applications') ?? 0);

    if (applications === 0) {
      line('!', styles.yellow, 'Connected, but the graph is empty.', 'Run `npm run db:seed` to load it.');
    } else {
      line(
        '✓',
        styles.green,
        'Graph is loaded.',
        `${applications} applications · ${row?.get('packages')} packages · ${row?.get('versions')} versions · ` +
          `${row?.get('advisories')} advisories · ${row?.get('dependencies')} dependency edges`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    line('!', styles.yellow, 'Connected, but the inventory query failed.', message);
  }

  await driver.close();
  process.stdout.write('\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${styles.red}${error instanceof Error ? error.message : String(error)}${styles.reset}\n`);
  process.exit(1);
});
