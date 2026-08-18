// A tiny static file server for the sample app this example demo captures against.
// No dependencies — just node:http and node:fs. Not for production use.
//
//   node serve.mjs [port]   defaults to 4173

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 4173);

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const file = path.join(HERE, decodeURIComponent(url.split('?')[0]));
  if (!file.startsWith(HERE)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => console.log(`Northwind Tasks sample app on http://localhost:${PORT}`));
