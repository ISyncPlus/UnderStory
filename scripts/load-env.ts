import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';

/**
 * Loads connection details for the command-line scripts.
 *
 * Next.js reads `.env.local` on its own; a bare `tsx` process does not, so the
 * scripts have to. Precedence matches Next's: a value already present in the
 * real environment always wins, then `.env.local`, then `.env`.
 */
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) dotenv.config({ path, override: false });
  }
}
