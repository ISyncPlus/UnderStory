import type { Application } from './model';

/** Meridian Systems — the fictional organisation whose estate this graph */
export const APPLICATIONS: readonly Application[] = [
  {
    slug: 'ledger-api',
    name: 'Ledger API',
    team: 'Payments',
    tier: 'critical',
    runtime: 'Node 20',
    purpose: 'Double-entry ledger of record. Every money movement lands here first.',
    firstShipped: '2019-03-11',
  },
  {
    slug: 'checkout-service',
    name: 'Checkout Service',
    team: 'Payments',
    tier: 'critical',
    runtime: 'Node 20',
    purpose: 'Card capture, 3-D Secure, and the retry ladder behind failed authorisations.',
    firstShipped: '2019-08-02',
  },
  {
    slug: 'auth-gateway',
    name: 'Auth Gateway',
    team: 'Platform',
    tier: 'critical',
    runtime: 'Node 20',
    purpose: 'Session issue and verification for every first-party surface.',
    firstShipped: '2018-11-27',
  },
  {
    slug: 'fraud-scoring',
    name: 'Fraud Scoring',
    team: 'Risk',
    tier: 'critical',
    runtime: 'Python 3.12',
    purpose: 'Scores authorisations in-line against a gradient-boosted model.',
    firstShipped: '2021-01-19',
  },
  {
    slug: 'storefront-web',
    name: 'Storefront Web',
    team: 'Commerce',
    tier: 'high',
    runtime: 'Node 20',
    purpose: 'The customer-facing shop. Server-rendered, edge-cached.',
    firstShipped: '2020-05-14',
  },
  {
    slug: 'mobile-bff',
    name: 'Mobile BFF',
    team: 'Mobile',
    tier: 'high',
    runtime: 'Node 20',
    purpose: 'Backend-for-frontend that flattens six services into one mobile payload.',
    firstShipped: '2021-09-30',
  },
  {
    slug: 'inventory-sync',
    name: 'Inventory Sync',
    team: 'Commerce',
    tier: 'high',
    runtime: 'Node 20',
    purpose: 'Reconciles warehouse stock against the storefront every four minutes.',
    firstShipped: '2020-07-22',
  },
  {
    slug: 'admin-console',
    name: 'Admin Console',
    team: 'Internal Tools',
    tier: 'high',
    runtime: 'Node 20',
    purpose: 'Support tooling. Refunds, account holds, and manual review queues.',
    firstShipped: '2019-06-05',
  },
  {
    slug: 'reporting-pipeline',
    name: 'Reporting Pipeline',
    team: 'Data',
    tier: 'high',
    runtime: 'Python 3.12',
    purpose: 'Nightly settlement and reconciliation reporting for finance.',
    firstShipped: '2020-02-18',
  },
  {
    slug: 'notification-relay',
    name: 'Notification Relay',
    team: 'Platform',
    tier: 'standard',
    runtime: 'Node 20',
    purpose: 'Fans transactional email, SMS, and push out to the right provider.',
    firstShipped: '2020-10-08',
  },
  {
    slug: 'data-exporter',
    name: 'Data Exporter',
    team: 'Data',
    tier: 'standard',
    runtime: 'Python 3.12',
    purpose: 'Customer-requested exports. Runs rarely, owned loosely.',
    firstShipped: '2022-04-12',
  },
  {
    slug: 'docs-site',
    name: 'Docs Site',
    team: 'Marketing',
    tier: 'standard',
    runtime: 'Node 20',
    purpose: 'Public API documentation. Static output, generous build-time toolchain.',
    firstShipped: '2021-03-03',
  },
];

/** Maintainer identities. */
export const CHOKEPOINT_MAINTAINERS: ReadonlyArray<{
  handle: string;
  name: string;
  joined: string;
  affiliation: string | null;
  /** Packages this maintainer solely owns, by `<ecosystem>:<name>` key. */
  owns: readonly string[];
}> = [
  {
    handle: 'okonkwo-e',
    name: 'Ekene Okonkwo',
    joined: '2013-04-02',
    affiliation: null,
    owns: ['npm:ms', 'npm:has-flag', 'npm:util-deprecate'],
  },
  {
    handle: 'delacroix',
    name: 'Margaux Delacroix',
    joined: '2012-09-19',
    affiliation: null,
    owns: ['npm:ansi-regex', 'npm:strip-ansi', 'npm:ansi-styles'],
  },
  {
    handle: 'j-nakamura',
    name: 'Jun Nakamura',
    joined: '2014-01-30',
    affiliation: null,
    owns: ['npm:balanced-match', 'npm:concat-map', 'npm:brace-expansion'],
  },
  {
    handle: 'svetla-p',
    name: 'Svetlana Popova',
    joined: '2011-11-08',
    affiliation: null,
    owns: ['npm:inherits', 'npm:string_decoder', 'npm:safe-buffer'],
  },
  {
    handle: 'akintola',
    name: 'Bisi Akintola',
    joined: '2015-06-24',
    affiliation: null,
    owns: ['pypi:sniffio', 'pypi:iniconfig', 'pypi:mdurl'],
  },
  {
    handle: 'quiller',
    name: 'Tom Quiller',
    joined: '2010-02-15',
    affiliation: null,
    owns: ['npm:color-name', 'npm:emoji-regex', 'npm:is-fullwidth-code-point'],
  },
];

/** Name components used to generate the remaining maintainer population. */
export const GIVEN_NAMES: readonly string[] = [
  'Adaeze', 'Alejandro', 'Amara', 'Anders', 'Aneta', 'Anika', 'Arjun', 'Beatriz',
  'Bram', 'Camila', 'Cathal', 'Chidi', 'Dagny', 'Dmitri', 'Elif', 'Emeka',
  'Esther', 'Farid', 'Fatima', 'Felix', 'Gita', 'Hanne', 'Hiroshi', 'Ines',
  'Ivan', 'Jae-won', 'Jonas', 'Kalinda', 'Karim', 'Katrin', 'Lars', 'Leila',
  'Lucia', 'Mahesh', 'Marta', 'Mateo', 'Mei', 'Nadia', 'Niamh', 'Nkechi',
  'Olek', 'Paloma', 'Pavel', 'Priya', 'Rafael', 'Rania', 'Ravi', 'Rowan',
  'Sanne', 'Sasha', 'Selin', 'Sofia', 'Takeshi', 'Tariq', 'Thandiwe', 'Tomas',
  'Ursula', 'Vikram', 'Wei', 'Yara', 'Yusuf', 'Zainab', 'Zoltan', 'Astrid',
];

export const FAMILY_NAMES: readonly string[] = [
  'Abara', 'Adeyemi', 'Ahmadi', 'Almeida', 'Andersson', 'Baptiste', 'Bergman',
  'Cabrera', 'Chowdhury', 'Dahl', 'Dubois', 'Eriksen', 'Falk', 'Ferreira',
  'Gallagher', 'Grimaldi', 'Haddad', 'Halvorsen', 'Ibrahim', 'Ivanova',
  'Jansen', 'Kaur', 'Kowalski', 'Laurent', 'Lindqvist', 'Marchetti', 'Mbeki',
  'Mensah', 'Moreau', 'Nakagawa', 'Navarro', 'Nwosu', 'Oduya', 'Olsen',
  'Pereira', 'Petrov', 'Rahman', 'Reyes', 'Ricci', 'Sandoval', 'Schneider',
  'Sharma', 'Sokolov', 'Tanaka', 'Thorne', 'Vasquez', 'Virtanen', 'Wallace',
  'Yamamoto', 'Zielinski',
];

/** Organisations that back some maintainers. `null` means unaffiliated. */
export const AFFILIATIONS: readonly (string | null)[] = [
  null, null, null, null, null,
  'Ironwood Labs', 'Northgate Foundation', 'Cavendish Software',
  'The Ostrom Institute', 'Quarry Collective', 'Halden Digital',
];
