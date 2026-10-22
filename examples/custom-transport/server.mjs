// A sync backend without Hocuspocus: plain HTTP for reading and writing, Server-Sent Events for live
// updates. It mirrors a typical app API (REST + a realtime channel) and keeps documents in memory.
//
//   GET  /docs/:id/diff?sv=<base64>   the update a client with that state vector lacks
//   POST /docs/:id/updates            body: one Yjs update (binary); 403 for read-only users
//   POST /docs/:id/awareness          body: an awareness update, relayed to everyone
//   GET  /docs/:id/events             SSE: `update` and `awareness` events (base64)
import { createServer } from 'node:http';
import { diffForStateVector, isValidStateVector, isValidUpdate, mergeUpdates } from '@proseline-editor/sync/server';

const port = Number(process.env.PORT ?? 4180);
/** Document id → merged Yjs state. A real server stores this in its database. */
const states = new Map();
/** Document id → open SSE responses. */
const listeners = new Map();

const empty = new Uint8Array([0, 0]); // an empty Yjs update
const fromBase64 = (text) => new Uint8Array(Buffer.from(text, 'base64'));
const toBase64 = (bytes) => Buffer.from(bytes).toString('base64');

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new Uint8Array(Buffer.concat(chunks));
};

const broadcast = (docId, event, bytes) => {
  for (const res of listeners.get(docId) ?? []) res.write(`event: ${event}\ndata: ${toBase64(bytes)}\n\n`);
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Role',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = /^\/docs\/([\w-]+)\/(diff|updates|awareness|events)$/.exec(url.pathname);
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (!match) return res.writeHead(404, cors).end();
  const [, docId, action] = match;

  if (action === 'diff' && req.method === 'GET') {
    const sv = url.searchParams.get('sv');
    const stateVector = sv ? fromBase64(sv) : undefined;
    if (stateVector && !isValidStateVector(stateVector)) return res.writeHead(400, cors).end();
    const diff = diffForStateVector(states.get(docId) ?? empty, stateVector);
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/octet-stream' }).end(Buffer.from(diff));
  }
  if (action === 'updates' && req.method === 'POST') {
    // Authorization belongs here; the example trusts a header. Viewers and revoked users may not write.
    if (req.headers['x-role'] !== 'writer') return res.writeHead(403, cors).end();
    const update = await readBody(req);
    if (!isValidUpdate(update)) return res.writeHead(400, cors).end();
    states.set(docId, mergeUpdates([states.get(docId) ?? empty, update]));
    broadcast(docId, 'update', update);
    return res.writeHead(204, cors).end();
  }
  if (action === 'awareness' && req.method === 'POST') {
    broadcast(docId, 'awareness', await readBody(req));
    return res.writeHead(204, cors).end();
  }
  if (action === 'events' && req.method === 'GET') {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    const set = listeners.get(docId) ?? new Set();
    set.add(res);
    listeners.set(docId, set);
    req.on('close', () => set.delete(res));
    return undefined;
  }
  return res.writeHead(405, cors).end();
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console -- a CLI script reporting its address
  console.log(`Sync server on http://127.0.0.1:${port}`);
});
