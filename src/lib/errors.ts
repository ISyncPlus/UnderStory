export type FailureKind =
  | 'unconfigured'
  | 'unreachable'
  | 'unauthorized'
  | 'timeout'
  | 'query'
  | 'unknown';

export type Failure = {
  kind: FailureKind;
  /** Short, human sentence. Safe to render. Never contains credentials. */
  title: string;
  /** What the reader can do about it. */
  detail: string;
  /** Driver/server code when we have one, for the technical disclosure. */
  code?: string;
};

/** Discriminated result. Query modules never throw at the page boundary. */
export type Outcome<T> = { ok: true; data: T; meta: QueryMeta } | { ok: false; failure: Failure };

export type QueryMeta = {
  /** Human name of the query, used as the disclosure heading. */
  name: string;
  /** One line explaining what the query answers. */
  purpose: string;
  /** The exact Cypher sent to the server. */
  cypher: string;
  /** The exact parameters bound to it. */
  params: Record<string, unknown>;
  /** Server round-trip in milliseconds. */
  elapsedMs: number;
  /** Number of records returned. */
  records: number;
};

/** Sanitizes error messages to prevent leaking connection details or credentials. */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/\b(bolt|neo4j)(\+s|\+ssc)?:\/\/\S+/gi, '<connection uri>')
    .replace(/\/\/[^@\s/]*@/g, '//')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<address>')
    .replace(/\b[\w.-]+\.databases\.cognodb\.cloud(?::\d+)?\b/gi, '<instance host>')
    .trim();
}

type DriverLikeError = { code?: unknown; message?: unknown; name?: unknown; cause?: unknown };

function codeOf(error: unknown): string | undefined {
  const candidate = error as DriverLikeError | null;
  if (candidate && typeof candidate.code === 'string' && candidate.code.length > 0) {
    return candidate.code;
  }
  const cause = (candidate?.cause ?? null) as DriverLikeError | null;
  if (cause && typeof cause.code === 'string' && cause.code.length > 0) return cause.code;
  return undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The database call failed for an unrecognised reason.';
}

/** Classifies driver and network errors into user-facing failure types. */
export function classifyError(error: unknown): Failure {
  const code = codeOf(error);
  const name = error instanceof Error ? error.name : '';
  const raw = messageOf(error);
  const message = sanitizeMessage(raw);

  if (code?.startsWith('Neo.ClientError.Security.')) {
    return {
      kind: 'unauthorized',
      title: 'The database refused these credentials',
      detail:
        'The instance answered, but rejected the username or password. Check NEO4J_USERNAME and NEO4J_PASSWORD against the CognoDB console — the password is shown only once at creation, and a rotated instance issues a new one.',
      ...(code ? { code } : {}),
    };
  }

  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    name === 'Neo4jError' && /timed out/i.test(raw) ||
    /timed out|timeout/i.test(raw)
  ) {
    return {
      kind: 'timeout',
      title: 'The database did not answer in time',
      detail:
        'Free-tier instances are burstable and can be slow on the first request after an idle period. Retrying usually succeeds; if it does not, the instance may be paused in the CognoDB console.',
      ...(code ? { code } : {}),
    };
  }

  if (
    name === 'ServiceUnavailable' ||
    name === 'SessionExpired' ||
    code === 'ServiceUnavailable' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    /could not perform discovery|unable to connect|connection acquisition|routing table/i.test(raw)
  ) {
    return {
      kind: 'unreachable',
      title: 'Cannot reach the database',
      detail:
        'Nothing answered at the configured address. Confirm the instance is running in the CognoDB console and that NEO4J_URI matches the bolt+s:// URI it shows.',
      ...(code ? { code } : {}),
    };
  }

  if (code?.startsWith('Neo.ClientError.Statement.') || code?.startsWith('Neo.ClientError.Schema.')) {
    return {
      kind: 'query',
      title: 'The database rejected the query',
      detail: `This is a defect in the application rather than in your instance. ${message}`,
      ...(code ? { code } : {}),
    };
  }

  return {
    kind: 'unknown',
    title: 'The database call failed',
    detail: message || 'No further detail was reported.',
    ...(code ? { code } : {}),
  };
}

export const UNCONFIGURED: Failure = {
  kind: 'unconfigured',
  title: 'No database is connected yet',
  detail:
    'Understory reads its graph from a CognoDB instance. Add NEO4J_URI and NEO4J_PASSWORD to .env.local, then seed the graph with `npm run db:seed`. docs/SETUP-COGNODB.md walks through it end to end.',
};
