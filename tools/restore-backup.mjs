// Restore a nightly database copy (docs/RECOVERY.md). Run on a computer, never on the live site:
//   BACKUP_KEY=... UPSTASH_REDIS_REST_URL=<TARGET> UPSTASH_REDIS_REST_TOKEN=<TARGET> node tools/restore-backup.mjs <file.json.enc> [--replace] [--check]
// --check only opens the file and prints what's inside. Without --replace it refuses a database that isn't empty.
import { readFileSync } from 'node:fs';
import { open, importAll } from '../api/_lib/backup.js';
const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error('Give the backup file.'); process.exit(1); }
const dump = open(readFileSync(file, 'utf8'), process.env.BACKUP_KEY);
const byType = dump.items.reduce((a, x) => (a[x.t] = (a[x.t] || 0) + 1, a), {});
console.log(`backup made ${dump.made}: ${dump.count} keys`, byType);
if (flags.includes('--check')) process.exit(0);
const n = await importAll(dump, process.env, { replace: flags.includes('--replace') });
console.log(`restored ${n} keys`);
