import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(join(__dirname, '..', '..', 'public'));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(res, pathname) {
  const relPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = resolve(PUBLIC_DIR, `.${relPath}`);

  // ディレクトリトラバーサル対策: 解決後のパスがpublic配下であることを確認する
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) {
    res.writeHead(403).end();
    return true;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export function createHttpServer(router) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname.startsWith('/api/')) {
      const matched = router.match(req.method, url.pathname);
      if (!matched) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      try {
        const body = ['POST', 'PUT'].includes(req.method) ? await readJsonBody(req) : undefined;
        await matched.handler({ req, res, params: matched.params, query: url.searchParams, body, sendJson });
      } catch (err) {
        sendJson(res, err.statusCode ?? 500, { error: err.message ?? 'internal error' });
      }
      return;
    }

    const served = await serveStatic(res, url.pathname);
    if (!served) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });
}
