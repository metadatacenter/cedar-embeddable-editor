/**
 * Static file server for public/, used by playwright.config.ts as its webServer.
 *
 * This was `python3 -m http.server` on the reasoning that python3 ships with macOS.
 * It no longer does: GitHub's macos-15 image has no python3 on PATH, and the process
 * failed to start with no output at all, which surfaced only as Playwright's generic
 * "Timed out waiting 30000ms from config.webServer". Node is already a hard
 * requirement for this suite, so depending on it instead removes a whole class of
 * environment drift. No npm dependency: `npx serve` would add one.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, resolve, sep } from 'node:path';

const ROOT = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const PORT = Number(process.argv[2] ?? 4455);

// Bound to 127.0.0.1 rather than every interface, matching the config's baseURL
// exactly. Binding broadly invites the IPv4/IPv6 ambiguity where a server listens on
// :: and a probe of 127.0.0.1 misses it.
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const send = (code, body = '') => {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(405, 'Method Not Allowed');
  }

  let pathname;
  try {
    ({ pathname } = new URL(req.url, `http://${HOST}:${PORT}`));
  } catch {
    return send(400, 'Bad Request');
  }
  pathname = decodeURIComponent(pathname);

  let target = resolve(join(ROOT, pathname));
  // Refuse anything that escapes public/, however it was spelled.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return send(403, 'Forbidden');
  }

  let info;
  try {
    info = await stat(target);
    if (info.isDirectory()) {
      target = join(target, 'index.html');
      info = await stat(target);
    }
  } catch {
    return send(404, 'Not Found');
  }

  // `no-store` where python3 sent nothing. HTTP lets a browser reuse an
  // uncontrolled response heuristically without revalidating, which is the
  // suspected cause of the stale-bundle flake documented in playwright.config.ts.
  // The versioned bundle URL already addresses that; this closes it off at the
  // source rather than relying on it.
  res.writeHead(200, {
    'Content-Type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-store, must-revalidate',
  });

  if (req.method === 'HEAD') return res.end();

  const stream = createReadStream(target);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${ROOT} at http://${HOST}:${PORT}`);
});
