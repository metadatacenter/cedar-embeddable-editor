import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyReports } from './sharding.ts';

function reports(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return reports(path);
    return /^shard-\d+-of-\d+\.json$/.test(entry.name) ? [JSON.parse(readFileSync(path, 'utf8'))] : [];
  });
}

const [directory, total = '4'] = process.argv.slice(2);
if (!directory) throw new Error('Usage: node shards/check-results.mjs REPORT_DIRECTORY [SHARD_COUNT]');
// The cases that may be skipped, each with its reason. Empty: no visual case skips.
const allowedSkips = JSON.parse(readFileSync(new URL('./allowed-skips.json', import.meta.url), 'utf8'));
console.log(JSON.stringify(verifyReports(reports(resolve(directory)), Number(total), allowedSkips), null, 2));
