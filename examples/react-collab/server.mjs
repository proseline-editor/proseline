// In-memory Hocuspocus server plus a comments/versions API for the example and its e2e tests (data vanishes on restart).
import { Server } from '@hocuspocus/server';
import { startExampleApi } from './example-api.mjs';

const port = Number(process.env.PORT ?? 4174);
const apiPort = Number(process.env.API_PORT ?? 4176);
const server = new Server({ port, quiet: true });
await server.listen();
await startExampleApi(apiPort);
// eslint-disable-next-line no-console -- a CLI script reporting its address
console.log(`Hocuspocus on ws://127.0.0.1:${port}, example API on http://127.0.0.1:${apiPort}`);
