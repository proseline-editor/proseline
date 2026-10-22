import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { comments, findReplace, focus, memoryCommentStore, memoryVersionStore, mentions, paragraphStyles, staticMentionProvider, stats, styleAnalysis, typography, versions } from '@proseline-editor/core/features';
import { en } from '@proseline-editor/lexicons/en';
import { fr } from '@proseline-editor/lexicons/fr';
import { uk } from '@proseline-editor/lexicons/uk';
import { FindReplace, FocusControls, MentionCasePicker, MentionMenu, ProselineContent, ProselineEditor, StatsBar, Toolbar } from '@proseline-editor/react';
import '@proseline-editor/react/theme.css';
import { ENTITIES, SAMPLE, bigDocument } from 'example-shared/sample';
import { Sidebar } from './sidebar';
import { ExportMenu } from './export-menu';
import { ImportButton } from './import-button';

const params = new URLSearchParams(window.location.search);
const big = params.get('big');
const locale = params.get('locale') ?? 'en';
const started = performance.now();
// Comments live in memory here (single-user, position anchors); a real host stores them on its server.
const commentStore = memoryCommentStore({ author: { id: 'you', name: 'You' } });
const versionStore = memoryVersionStore({ authorName: 'You' });
const mentionProvider = staticMentionProvider(ENTITIES);
const lexicon = { en, uk, fr }[locale] ?? en;

const App = () => (
  <ProselineEditor
    content={big ? bigDocument(Number(big)) : SAMPLE}
    locale={locale}
    placeholder="Start writing…"
    features={[typography(), paragraphStyles(), findReplace(), stats({ goal: 1000 }), focus(), comments({ store: commentStore, docId: 'sample' }), versions({ store: versionStore, docId: 'sample' }), mentions({ provider: mentionProvider }), styleAnalysis({ lexicon, enabled: params.has('style') })]}
    onReady={() => {
      // Read by the e2e performance test.
      (window as unknown as { __proselineReadyMs: number }).__proselineReadyMs = performance.now() - started;
    }}
    className="app-editor"
  >
    <Toolbar>
      <FocusControls />
      <ExportMenu commentStore={commentStore} />
      <ImportButton />
    </Toolbar>
    <FindReplace />
    <div className="pl-columns">
      <ProselineContent />
      <Sidebar />
    </div>
    <StatsBar />
    <MentionMenu />
    <MentionCasePicker />
  </ProselineEditor>
);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
