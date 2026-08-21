import type { Severity } from './model';

/** Advisories. */
export type AdvisorySeed = {
  id: string;
  /** `<ecosystem>:<name>` of the affected package. */
  packageKey: string;
  title: string;
  severity: Severity;
  score: number;
  weakness: string;
  summary: string;
  published: string;
  /** The version that resolves it. `null` when no fixed release exists. */
  fixedIn: string | null;
  /** The first version carrying the flaw, when known. */
  introducedIn: string | null;
  /** Headline advisories are asserted to reach at least this many applications */
  minimumApplicationsReached?: number;
};

export const ADVISORIES: readonly AdvisorySeed[] = [
  {
    id: 'USY-2026-0101',
    packageKey: 'npm:lodash',
    title: 'Prototype pollution in deep merge helpers',
    severity: 'high',
    score: 7.4,
    weakness: 'Prototype pollution',
    summary:
      'A crafted key path passed to the deep-merge helpers writes onto Object.prototype. Any code that later reads an unguarded property from a plain object can be steered by an attacker who controls one merge input.',
    published: '2026-02-04',
    fixedIn: '4.17.21',
    introducedIn: '4.14.0',
    minimumApplicationsReached: 4,
  },
  {
    id: 'USY-2026-0102',
    packageKey: 'npm:ms',
    title: 'Catastrophic backtracking in duration parsing',
    severity: 'medium',
    score: 5.3,
    weakness: 'Regular expression denial of service',
    summary:
      'The duration grammar backtracks super-linearly on a long run of digits. A single request carrying an attacker-supplied timeout string can hold an event loop for seconds.',
    published: '2026-01-22',
    fixedIn: '2.1.3',
    introducedIn: '2.0.0',
    minimumApplicationsReached: 6,
  },
  {
    id: 'USY-2026-0103',
    packageKey: 'npm:minimatch',
    title: 'Denial of service via nested pattern expansion',
    severity: 'high',
    score: 7.5,
    weakness: 'Regular expression denial of service',
    summary:
      'Deeply nested brace groups expand combinatorially before any bound is applied. Reached wherever a glob pattern crosses a trust boundary.',
    published: '2026-03-16',
    fixedIn: '3.0.5',
    introducedIn: '3.0.0',
    minimumApplicationsReached: 5,
  },
  {
    id: 'USY-2026-0104',
    packageKey: 'npm:axios',
    title: 'Server-side request forgery through absolute redirect targets',
    severity: 'critical',
    score: 9.1,
    weakness: 'Server-side request forgery',
    summary:
      'An absolute URL in a redirect response is followed without re-applying the caller`s base-URL restriction, allowing a remote host to redirect an outbound request onto an internal address.',
    published: '2026-04-02',
    fixedIn: '1.7.4',
    introducedIn: '1.3.0',
    minimumApplicationsReached: 3,
  },
  {
    id: 'USY-2026-0105',
    packageKey: 'npm:follow-redirects',
    title: 'Authorization header retained across host change',
    severity: 'critical',
    score: 9.0,
    weakness: 'Exposure of sensitive information',
    summary:
      'On a cross-host redirect the Authorization and Cookie headers are replayed to the new host. A third-party endpoint that redirects can harvest the caller`s credentials.',
    published: '2026-02-27',
    fixedIn: '1.15.6',
    introducedIn: '1.14.0',
    minimumApplicationsReached: 3,
  },
  {
    id: 'USY-2026-0106',
    packageKey: 'npm:jsonwebtoken',
    title: 'Algorithm confusion permits signature bypass',
    severity: 'critical',
    score: 9.8,
    weakness: 'Improper authentication',
    summary:
      'When a public key is supplied as a verification secret without pinning the algorithm, an HMAC-signed token is validated against that public key as if it were a shared secret. Any party holding the public key can mint an accepted token.',
    published: '2026-01-09',
    fixedIn: '9.0.2',
    introducedIn: '8.0.0',
    minimumApplicationsReached: 2,
  },
  {
    id: 'USY-2026-0107',
    packageKey: 'npm:tough-cookie',
    title: 'Prototype pollution in cookie jar construction',
    severity: 'medium',
    score: 6.5,
    weakness: 'Prototype pollution',
    summary:
      'A cookie whose domain is `__proto__` is stored under that key in the in-memory jar, mutating the prototype shared by every subsequent lookup.',
    published: '2026-03-01',
    fixedIn: '4.1.3',
    introducedIn: '4.0.0',
  },
  {
    id: 'USY-2026-0108',
    packageKey: 'npm:semver',
    title: 'Backtracking in range parsing',
    severity: 'medium',
    score: 5.5,
    weakness: 'Regular expression denial of service',
    summary:
      'Range strings with long whitespace runs cause exponential backtracking in the comparator grammar. Reached anywhere a user-supplied version range is parsed.',
    published: '2026-02-11',
    fixedIn: '7.5.2',
    introducedIn: '7.0.0',
    minimumApplicationsReached: 4,
  },
  {
    id: 'USY-2026-0109',
    packageKey: 'npm:ws',
    title: 'Denial of service via excessive header count',
    severity: 'high',
    score: 7.5,
    weakness: 'Uncontrolled resource consumption',
    summary:
      'A handshake carrying tens of thousands of headers is parsed in full before any limit is enforced, exhausting the heap on a small instance.',
    published: '2026-04-19',
    fixedIn: '8.17.1',
    introducedIn: '8.0.0',
  },
  {
    id: 'USY-2026-0110',
    packageKey: 'npm:node-forge',
    title: 'Signature verification accepts malformed digest info',
    severity: 'critical',
    score: 9.3,
    weakness: 'Improper certificate validation',
    summary:
      'Trailing bytes after the digest in a PKCS#1 v1.5 structure are ignored, so a forged signature verifies against a legitimate key.',
    published: '2026-01-30',
    fixedIn: '1.3.1',
    introducedIn: '1.0.0',
  },
  {
    id: 'USY-2026-0111',
    packageKey: 'npm:qs',
    title: 'Prototype pollution through bracketed query keys',
    severity: 'high',
    score: 7.5,
    weakness: 'Prototype pollution',
    summary:
      'A query string of the form `a[__proto__][x]=1` writes through to the object prototype during parsing, before any application code sees the request.',
    published: '2026-03-24',
    fixedIn: '6.11.2',
    introducedIn: '6.9.0',
    minimumApplicationsReached: 4,
  },
  {
    id: 'USY-2026-0112',
    packageKey: 'npm:ansi-regex',
    title: 'Backtracking on unterminated escape sequences',
    severity: 'low',
    score: 3.7,
    weakness: 'Regular expression denial of service',
    summary:
      'An unterminated ANSI escape followed by a long payload backtracks quadratically. Low impact in isolation; notable because of how far the package reaches.',
    published: '2026-02-19',
    fixedIn: '5.0.1',
    introducedIn: '4.0.0',
    minimumApplicationsReached: 5,
  },
  {
    id: 'USY-2026-0113',
    packageKey: 'npm:brace-expansion',
    title: 'Quadratic expansion on nested comma groups',
    severity: 'medium',
    score: 5.3,
    weakness: 'Regular expression denial of service',
    summary:
      'Nested comma groups are expanded eagerly. A short pattern can produce a very large intermediate array before any consumer applies a limit.',
    published: '2026-04-08',
    fixedIn: '2.0.2',
    introducedIn: '2.0.0',
  },
  {
    id: 'USY-2026-0114',
    packageKey: 'npm:tar',
    title: 'Path traversal when extracting symbolic links',
    severity: 'high',
    score: 8.1,
    weakness: 'Path traversal',
    summary:
      'An archive entry that first creates a symlink and then writes through it escapes the extraction root, allowing an attacker-authored archive to write outside the target directory.',
    published: '2026-03-07',
    fixedIn: '6.2.1',
    introducedIn: '6.0.0',
  },
  {
    id: 'USY-2026-0115',
    packageKey: 'npm:sharp',
    title: 'Heap overflow in the bundled image decoder',
    severity: 'high',
    score: 8.6,
    weakness: 'Heap buffer overflow',
    summary:
      'A malformed chunk header in a user-uploaded image overflows a fixed-size buffer in the native decoder. Reached by anything that resizes an upload.',
    published: '2026-04-25',
    fixedIn: '0.33.4',
    introducedIn: '0.32.0',
  },
  {
    id: 'USY-2026-0116',
    packageKey: 'npm:undici',
    title: 'Request smuggling via unvalidated header names',
    severity: 'high',
    score: 8.2,
    weakness: 'HTTP request smuggling',
    summary:
      'Header names containing control characters are forwarded verbatim, allowing a request to be split at an intermediary that parses them differently.',
    published: '2026-05-02',
    fixedIn: '6.19.2',
    introducedIn: '6.0.0',
    minimumApplicationsReached: 3,
  },
  {
    id: 'USY-2026-0117',
    packageKey: 'pypi:requests',
    title: 'Proxy credentials leaked to the destination host',
    severity: 'high',
    score: 7.6,
    weakness: 'Exposure of sensitive information',
    summary:
      'Proxy-Authorization survives the transition from proxy tunnel to origin request, disclosing proxy credentials to the destination.',
    published: '2026-02-14',
    fixedIn: '2.32.0',
    introducedIn: '2.28.0',
    minimumApplicationsReached: 2,
  },
  {
    id: 'USY-2026-0118',
    packageKey: 'pypi:urllib3',
    title: 'Redirect not re-authorised after scheme downgrade',
    severity: 'medium',
    score: 6.1,
    weakness: 'Improper access control',
    summary:
      'A redirect from https to http reuses the original connection pool settings, silently downgrading transport security for the follow-up request.',
    published: '2026-03-19',
    fixedIn: '2.2.2',
    introducedIn: '2.0.0',
    minimumApplicationsReached: 2,
  },
  {
    id: 'USY-2026-0119',
    packageKey: 'pypi:cryptography',
    title: 'Null dereference parsing a malformed certificate chain',
    severity: 'high',
    score: 7.5,
    weakness: 'NULL pointer dereference',
    summary:
      'A certificate with an empty issuer sequence crashes the parser in native code, terminating the worker process handling the connection.',
    published: '2026-01-28',
    fixedIn: '42.0.4',
    introducedIn: '41.0.0',
  },
  {
    id: 'USY-2026-0120',
    packageKey: 'pypi:pyyaml',
    title: 'Unsafe constructor reachable through the default loader',
    severity: 'critical',
    score: 9.8,
    weakness: 'Deserialization of untrusted data',
    summary:
      'A document tag routed through the default loader instantiates arbitrary Python objects. Any code path that parses a user-supplied YAML document is affected.',
    published: '2026-02-06',
    fixedIn: '6.0.1',
    introducedIn: '5.0.0',
    minimumApplicationsReached: 2,
  },
  {
    id: 'USY-2026-0121',
    packageKey: 'npm:debug',
    title: 'Backtracking in namespace matching — no fixed release',
    severity: 'low',
    score: 3.1,
    weakness: 'Regular expression denial of service',
    summary:
      'Namespace wildcards compile to a pattern that backtracks on long, highly repetitive namespace strings. No fixed release has been published; the maintainers consider the input trusted.',
    published: '2026-04-30',
    fixedIn: null,
    introducedIn: '4.0.0',
    minimumApplicationsReached: 5,
  },
  {
    id: 'USY-2026-0122',
    packageKey: 'npm:color-name',
    title: 'Unauthorised release published from a compromised account',
    severity: 'critical',
    score: 9.8,
    weakness: 'Malicious code',
    summary:
      'A release was published from a maintainer account without a second factor. The added post-install step read environment variables and posted them to a remote collector. The release was pulled, but any lockfile written while it was live still resolves to it.',
    published: '2026-05-11',
    fixedIn: '1.1.5',
    introducedIn: '1.1.4',
    minimumApplicationsReached: 4,
  },
];

export const ADVISORY_BY_ID: ReadonlyMap<string, AdvisorySeed> = new Map(
  ADVISORIES.map((advisory) => [advisory.id, advisory]),
);
