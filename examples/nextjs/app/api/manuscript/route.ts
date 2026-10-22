import type { JSONContent } from '@tiptap/core';
import { loadManuscript, saveManuscript } from '../../../lib/store';

export const GET = () => Response.json(loadManuscript());

export const PUT = async (request: Request) => {
  const content = (await request.json()) as JSONContent;
  if (content?.type !== 'doc') return new Response('Expected ProseMirror JSON', { status: 400 });
  saveManuscript(content);
  return new Response(null, { status: 204 });
};
