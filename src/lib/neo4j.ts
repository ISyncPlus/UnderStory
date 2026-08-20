import 'server-only';

import neo4j, { type Driver, type Record as Neo4jRecord } from 'neo4j-driver';

import { ConfigurationError, readConnectionConfig } from './env';
import { UNCONFIGURED, classifyError, type Outcome, type QueryMeta } from './errors';

/**
 * Driver lifecycle.
 *
 * The official driver owns a connection pool and is designed to be created
 * once and shared. On a serverless host each warm instance keeps its own
 * driver; caching it on `globalThis` means a warm invocation reuses the pool
 * instead of opening a fresh TLS handshake per request, and it survives the
 * module re-evaluation that Next's dev server does on every edit.
 *
 * Nothing in the request path ever calls `driver.close()`. Closing per request
 * is the single most common way to exhaust a small instance's connection
 * budget; the free (c0) tier allows 200.
 */
const DRIVER_KEY = Symbol.for('understory.neo4j.driver');

type DriverHolder = { [DRIVER_KEY]?: Driver };

function driverHolder(): DriverHolder {
  return globalThis as unknown as DriverHolder;
}

export function getDriver(): Driver {
  const holder = driverHolder();
  const existing = holder[DRIVER_KEY];
  if (existing) return existing;

  const config = readConnectionConfig();
  const driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
    {
      // Our largest value is a node count in the low thousands, far below
      // 2^53. Returning plain JS numbers removes an entire class of
      // serialisation bugs at the Server/Client Component boundary, where a
      // driver Integer instance cannot cross.
      disableLosslessIntegers: true,
      // Free-tier instances are burstable and can be cold. These bounds keep
      // a slow instance from holding a request open indefinitely while still
      // giving a cold start room to answer.
      connectionTimeout: 15_000,
      connectionAcquisitionTimeout: 20_000,
      maxTransactionRetryTime: 8_000,
      maxConnectionPoolSize: 24,
      maxConnectionLifetime: 55 * 60 * 1000,
      userAgent: 'understory/1.0',
    },
  );

  holder[DRIVER_KEY] = driver;
  return driver;
}

/**
 * Server-side cap on how long a single read may run.
 *
 * A bounded traversal should never approach this; it exists so that a
 * pathological query on a burstable instance fails as a named timeout state
 * instead of holding a serverless invocation open until the platform kills it.
 * Set NEO4J_QUERY_TIMEOUT_MS=0 to omit the transaction metadata entirely if a
 * server rejects it.
 */
const QUERY_TIMEOUT_MS = (() => {
  const raw = process.env.NEO4J_QUERY_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === '') return 20_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 20_000;
})();

function databaseName(): string | undefined {
  const configured = readConnectionConfig().database;
  return configured.length > 0 ? configured : undefined;
}

/**
 * A read query, with the metadata every surface needs to explain itself.
 *
 * `cypher` is always a module-level constant and every value travels in
 * `params`. There is no code path in this application that concatenates a
 * value into a query string.
 */
export type ReadQuery<TParams extends Record<string, unknown>, TResult> = {
  name: string;
  purpose: string;
  cypher: string;
  /** Maps driver records to plain, serialisable objects. */
  map: (records: Neo4jRecord[]) => TResult;
  params: TParams;
};

const CACHE_KEY = Symbol.for('understory.neo4j.cache');
const INFLIGHT_KEY = Symbol.for('understory.neo4j.inflight');

type CacheEntry<T> = {
  data: T;
  recordsCount: number;
  cachedAt: number;
};

type CacheHolder = {
  [CACHE_KEY]?: Map<string, CacheEntry<unknown>>;
  [INFLIGHT_KEY]?: Map<string, Promise<unknown>>;
};

function cacheHolder(): CacheHolder {
  return globalThis as unknown as CacheHolder;
}

function getQueryCache(): Map<string, CacheEntry<unknown>> {
  const holder = cacheHolder();
  if (!holder[CACHE_KEY]) {
    holder[CACHE_KEY] = new Map();
  }
  return holder[CACHE_KEY]!;
}

function getInflightMap(): Map<string, Promise<unknown>> {
  const holder = cacheHolder();
  if (!holder[INFLIGHT_KEY]) {
    holder[INFLIGHT_KEY] = new Map();
  }
  return holder[INFLIGHT_KEY]!;
}

/** Cache TTL in milliseconds (5 minutes by default). */
const CACHE_TTL_MS = 5 * 60 * 1000;

function computeCacheKey(cypher: string, params: unknown, database?: string): string {
  return `${database ?? 'default'}::${cypher.trim()}::${JSON.stringify(params)}`;
}

/** Purges the in-memory query cache. */
export function clearCache(): void {
  getQueryCache().clear();
}

/**
 * Runs a read query and returns a discriminated outcome.
 *
 * Results are cached in memory with a 5-minute TTL to ensure instantaneous
 * navigation and reloads while eliminating redundant round-trips to the
 * remote database. Simultaneous in-flight requests for the same query are
 * deduplicated automatically.
 */
export async function read<TParams extends Record<string, unknown>, TResult>(
  query: ReadQuery<TParams, TResult>,
): Promise<Outcome<TResult>> {
  const startedAt = Date.now();
  const database = databaseName();
  const cacheKey = computeCacheKey(query.cypher, query.params, database);
  const cache = getQueryCache();

  // 1. Serve from in-memory cache if fresh
  const cached = cache.get(cacheKey) as CacheEntry<TResult> | undefined;
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    const meta: QueryMeta = {
      name: query.name,
      purpose: query.purpose,
      cypher: query.cypher.trim(),
      params: query.params,
      elapsedMs: 0,
      records: cached.recordsCount,
    };
    return { ok: true, data: cached.data, meta };
  }

  // 2. Deduplicate identical concurrent in-flight queries
  const inflight = getInflightMap();
  const existing = inflight.get(cacheKey) as Promise<Outcome<TResult>> | undefined;
  if (existing) {
    return existing;
  }

  // 3. Execute query against database
  const execution = (async (): Promise<Outcome<TResult>> => {
    try {
      const driver = getDriver();
      const { records } = await driver.executeQuery(query.cypher, query.params, {
        routing: neo4j.routing.READ,
        ...(database ? { database } : {}),
        ...(QUERY_TIMEOUT_MS > 0 ? { transactionConfig: { timeout: QUERY_TIMEOUT_MS } } : {}),
      });

      const data = query.map(records);
      const elapsedMs = Date.now() - startedAt;

      // Store in memory cache
      cache.set(cacheKey, {
        data,
        recordsCount: records.length,
        cachedAt: Date.now(),
      });

      const meta: QueryMeta = {
        name: query.name,
        purpose: query.purpose,
        cypher: query.cypher.trim(),
        params: query.params,
        elapsedMs,
        records: records.length,
      };

      return { ok: true, data, meta };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        return { ok: false, failure: UNCONFIGURED };
      }
      return { ok: false, failure: classifyError(error) };
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, execution);
  return execution;
}

export type Health =
  | { status: 'ok'; latencyMs: number; address: string | null; version: string | null }
  | { status: 'down'; latencyMs: number; failure: ReturnType<typeof classifyError> };

/**
 * Connectivity probe used by the header indicator, the health route, and the
 * `npm run db:check` script.
 */
export async function checkHealth(): Promise<Health> {
  const startedAt = Date.now();
  try {
    const driver = getDriver();
    const database = databaseName();
    await driver.verifyConnectivity(database ? { database } : {});
    const { records } = await driver.executeQuery(
      'CALL dbms.components() YIELD name, versions RETURN name AS name, versions AS versions',
      {},
      { routing: neo4j.routing.READ, ...(database ? { database } : {}) },
    );
    const first = records[0];
    const versions = first?.get('versions') as string[] | undefined;
    return {
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      address: null,
      version: versions?.[0] ?? null,
    };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return { status: 'down', latencyMs: Date.now() - startedAt, failure: UNCONFIGURED };
    }
    // `dbms.components()` is a Neo4j-specific procedure. If the server
    // answered but does not expose it, connectivity is still fine — we only
    // treat a genuine connection failure as "down".
    const failure = classifyError(error);
    if (failure.kind === 'query') {
      return { status: 'ok', latencyMs: Date.now() - startedAt, address: null, version: null };
    }
    return { status: 'down', latencyMs: Date.now() - startedAt, failure };
  }
}

/** Explicit teardown. Used by scripts, never by the request path. */
export async function closeDriver(): Promise<void> {
  const holder = driverHolder();
  const existing = holder[DRIVER_KEY];
  if (existing) {
    delete holder[DRIVER_KEY];
    await existing.close();
  }
}
