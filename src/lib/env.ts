/**
 * Runtime configuration.
 *
 * Connection details live only in the environment. Nothing here is ever
 * imported from a Client Component — `readConnectionConfig()` touches
 * `process.env`, which is server-only by construction.
 *
 * We validate lazily rather than at module load so that `next build` succeeds
 * on a machine with no database configured. A build that requires production
 * secrets is a build that cannot be verified in CI.
 */

export type ConnectionConfig = {
  uri: string;
  username: string;
  password: string;
  /** Empty string means "use the instance default database". */
  database: string;
  /** Cosmetic label surfaced in the UI so a reviewer knows which instance they are on. */
  instanceLabel: string;
};

export class ConfigurationError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Missing required environment ${missing.length === 1 ? 'variable' : 'variables'}: ${missing.join(', ')}`,
    );
    this.name = 'ConfigurationError';
    this.missing = missing;
  }
}

const PLACEHOLDER = /REPLACE_ME/i;

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * Reads and validates the connection configuration.
 *
 * @throws {ConfigurationError} when a required variable is absent or still
 * carries the placeholder from `.env.example`.
 */
export function readConnectionConfig(): ConnectionConfig {
  const uri = clean(process.env.NEO4J_URI);
  const username = clean(process.env.NEO4J_USERNAME) || 'cognodb';
  const password = clean(process.env.NEO4J_PASSWORD);

  const missing: string[] = [];
  if (!uri || PLACEHOLDER.test(uri)) missing.push('NEO4J_URI');
  if (!password || PLACEHOLDER.test(password)) missing.push('NEO4J_PASSWORD');
  if (missing.length > 0) throw new ConfigurationError(missing);

  return {
    uri,
    username,
    password,
    database: clean(process.env.NEO4J_DATABASE),
    instanceLabel: clean(process.env.NEXT_PUBLIC_INSTANCE_LABEL) || 'CognoDB',
  };
}

/** True when the environment carries enough detail to attempt a connection. */
export function isConfigured(): boolean {
  try {
    readConnectionConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * The host portion of the configured URI, safe to display.
 * Never returns credentials — the URI form CognoDB issues carries none, but a
 * hand-edited `NEO4J_URI` might, so we strip any userinfo defensively.
 */
export function describeTarget(): string | null {
  const uri = clean(process.env.NEO4J_URI);
  if (!uri || PLACEHOLDER.test(uri)) return null;
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return uri.replace(/\/\/[^@/]*@/, '//');
  }
}
