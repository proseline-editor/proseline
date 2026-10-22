import { createApp, h } from 'vue';
import { comments, findReplace, focus, memoryCommentStore, memoryVersionStore, mentions, paragraphStyles, staticMentionProvider, stats, styleAnalysis, typography, versions } from '@proseline-editor/core/features';
import { en } from '@proseline-editor/lexicons/en';
import { fr } from '@proseline-editor/lexicons/fr';
import { uk } from '@proseline-editor/lexicons/uk';
import { FindReplace, FocusControls, MentionCasePicker, MentionMenu, ProselineContent, ProselineEditor, StatsBar, Toolbar } from '@proseline-editor/vue';
import '@proseline-editor/vue/theme.css';
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

// The same page as the React example, so both run the same browser tests (examples/shared/e2e).
const App = () =>
  h(
    ProselineEditor,
    {
      content: big ? bigDocument(Number(big)) : SAMPLE,
      locale,
      placeholder: 'Start writing…',
      features: [typography(), paragraphStyles(), findReplace(), stats({ goal: 1000 }), focus(), comments({ store: commentStore, docId: 'sample' }), versions({ store: versionStore, docId: 'sample' }), mentions({ provider: mentionProvider }), styleAnalysis({ lexicon, enabled: params.has('style') })],
      onReady: () => {
        // Read by the e2e performance test.
        (window as unknown as { __proselineReadyMs: number }).__proselineReadyMs = performance.now() - started;
      },
      class: 'app-editor',
    },
    () => [
      h(Toolbar, null, () => [h(FocusControls), h(ExportMenu, { commentStore }), h(ImportButton)]),
      h(FindReplace),
      h('div', { class: 'pl-columns' }, [h(ProselineContent), h(Sidebar)]),
      h(StatsBar),
      h(MentionMenu),
      h(MentionCasePicker),
    ],
  );

createApp(App).mount('#root');
