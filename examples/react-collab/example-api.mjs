// A tiny in-memory comments + versions API for the example (a real host keeps these in its own database).
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export const startExampleApi = (port) => {
  const threads = new Map();
  const versions = []; // { meta, content }
  const changes = new Map(); // `${kind}:${docId}` → change counter, polled by clients
  const bump = (kind, docId) => changes.set(`${kind}:${docId}`, (changes.get(`${kind}:${docId}`) ?? 0) + 1);
  const comment = (body, author) => ({ id: randomUUID(), authorId: author?.id ?? 'anon', authorName: author?.name, body, createdAt: new Date().toISOString() });
  const readJson = (req) =>
    new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    });

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.end();
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body ?? null));
    };
    const url = new URL(req.url, 'http://localhost');
    const [, kind, id, sub] = url.pathname.split('/');

    // Change counters: /docs/:doc/version (comments), /docs/:doc/versions-version (versions)
    if (kind === 'docs' && sub === 'version') return send(200, changes.get(`comments:${id}`) ?? 0);
    if (kind === 'docs' && sub === 'versions-version') return send(200, changes.get(`versions:${id}`) ?? 0);

    // Comments
    if (kind === 'docs' && sub === 'threads' && req.method === 'GET') return send(200, [...threads.values()].filter((t) => t.docId === id));
    if (kind === 'docs' && sub === 'threads' && req.method === 'POST') {
      const { anchor, body, author } = await readJson(req);
      const thread = { id: randomUUID(), docId: id, anchor, resolved: false, createdAt: new Date().toISOString(), comments: [comment(body, author)] };
      threads.set(thread.id, thread);
      bump('comments', id);
      return send(201, thread);
    }
    if (kind === 'threads') {
      const thread = threads.get(id);
      if (!thread) return send(404, { error: 'not found' });
      if (sub === 'replies' && req.method === 'POST') {
        const { body, author } = await readJson(req);
        thread.comments.push(comment(body, author));
        bump('comments', thread.docId);
        return send(200, thread);
      }
      if (req.method === 'PATCH') {
        const patch = await readJson(req);
        if ('resolved' in patch) thread.resolved = patch.resolved;
        if ('anchor' in patch) thread.anchor = patch.anchor;
        bump('comments', thread.docId);
        return send(200, thread);
      }
      if (req.method === 'DELETE') {
        threads.delete(id);
        bump('comments', thread.docId);
        return send(204);
      }
    }

    // Versions
    if (kind === 'docs' && sub === 'versions' && req.method === 'GET') {
      return send(200, versions.filter((v) => v.meta.docId === id).map((v) => v.meta).reverse());
    }
    if (kind === 'docs' && sub === 'versions' && req.method === 'POST') {
      const { content, label, auto, words, authorName } = await readJson(req);
      const meta = { id: randomUUID(), docId: id, label, auto, words, createdAt: new Date().toISOString(), authorName };
      versions.push({ meta, content });
      bump('versions', id);
      return send(201, meta);
    }
    if (kind === 'versions') {
      const index = versions.findIndex((v) => v.meta.id === id);
      if (index < 0) return send(404, { error: 'not found' });
      if (req.method === 'GET') return send(200, versions[index].content);
      if (req.method === 'DELETE') {
        const [removed] = versions.splice(index, 1);
        bump('versions', removed.meta.docId);
        return send(204);
      }
    }
    return send(404, { error: 'not found' });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
};
