import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';

/** Loads connection details for the command-line scripts. */
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) dotenv.config({ path, override: false });
  }
}
