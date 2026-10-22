import { renderDocx } from '@proseline-editor/export';
import { loadManuscript } from '../../../lib/store';

// DOCX is produced on the server, from the stored manuscript; the browser only downloads it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  const { data } = await renderDocx({ documents: [{ content: loadManuscript() }], metadata: { title: 'Salt and Tide', author: 'Ann Lee' } });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="salt-and-tide.docx"',
    },
  });
};
