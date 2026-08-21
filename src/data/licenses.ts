import type { License } from './model';

/** Licences, categorised by the obligation they place on a distributor. */
export const LICENSES: readonly License[] = [
  {
    spdxId: 'MIT',
    name: 'MIT License',
    category: 'permissive',
    note: 'Attribution only. No obligation to publish source.',
  },
  {
    spdxId: 'Apache-2.0',
    name: 'Apache License 2.0',
    category: 'permissive',
    note: 'Attribution plus an explicit patent grant.',
  },
  {
    spdxId: 'BSD-3-Clause',
    name: 'BSD 3-Clause License',
    category: 'permissive',
    note: 'Attribution, with a no-endorsement clause.',
  },
  {
    spdxId: 'BSD-2-Clause',
    name: 'BSD 2-Clause License',
    category: 'permissive',
    note: 'Attribution only.',
  },
  {
    spdxId: 'ISC',
    name: 'ISC License',
    category: 'permissive',
    note: 'Functionally equivalent to MIT.',
  },
  {
    spdxId: 'Unlicense',
    name: 'The Unlicense',
    category: 'public-domain',
    note: 'Dedicated to the public domain.',
  },
  {
    spdxId: 'Python-2.0',
    name: 'Python Software Foundation License',
    category: 'permissive',
    note: 'Permissive, with attribution and change notices.',
  },
  {
    spdxId: 'MPL-2.0',
    name: 'Mozilla Public License 2.0',
    category: 'weak-copyleft',
    note: 'Modified files must be published. Larger works may stay closed.',
  },
  {
    spdxId: 'LGPL-3.0',
    name: 'GNU Lesser General Public License v3.0',
    category: 'weak-copyleft',
    note: 'Dynamic linking is permitted; modifications to the library are not.',
  },
  {
    spdxId: 'GPL-3.0',
    name: 'GNU General Public License v3.0',
    category: 'strong-copyleft',
    note: 'Distributing a derived work obliges you to publish its source.',
  },
  {
    spdxId: 'AGPL-3.0',
    name: 'GNU Affero General Public License v3.0',
    category: 'network-copyleft',
    note: 'Serving the work over a network counts as distribution.',
  },
];

export const LICENSE_BY_ID: ReadonlyMap<string, License> = new Map(
  LICENSES.map((license) => [license.spdxId, license]),
);
