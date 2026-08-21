export type ConnectionConfig = {
  uri: string;
  username: string;
  password: string;
  /** Empty string means "use the instance default database". */
  database: string;
  
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
 * Reads and validates Neo4j connection configuration from environment variables.
 * @throws {ConfigurationError} when required variables are missing or unset.
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

/** The host portion of the configured URI, safe to display. */
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
