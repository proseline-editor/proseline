import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { defineFeature, type Feature, type FeatureController } from '../../feature.js';
import { createStore } from '../../store.js';
import { analyzeText, readability, type AnalyzeOptions, type Readability, type TextAnalysis } from './analyze.js';
import { availableChecks, STYLE_CHECKS, type StyleCheck, type StyleLexicon } from './lexicon.js';
import { blockText, styleKey, stylePlugin } from './plugin.js';
import { visibleBlocks } from './viewport.js';

export { analyzeText, readability, MIN_READABILITY_WORDS, type AnalyzeOptions, type Readability, type ReadabilityLevel, type StyleIssue, type TextAnalysis } from './analyze.js';
export { availableChecks, extendLexicon, STYLE_CHECKS, type LexiconExtension, type StyleCheck, type StyleLexicon } from './lexicon.js';

export interface StyleAnalysisOptions extends AnalyzeOptions {
  lexicon: StyleLexicon;
  /** Highlight from the start. Default false: analysis runs only while switched on. */
  enabled?: boolean;
  /** Checks switched on at the start. Default: all the lexicon supports. */
  checks?: Partial<Record<StyleCheck, boolean>>;
  /** Pause after the last edit before re-analyzing, in ms. Default 300. */
  debounceMs?: number;
}

export interface StyleAnalysisState {
  enabled: boolean;
  /** Checks the lexicon supports, in display order. */
  available: StyleCheck[];
  checks: Record<StyleCheck, boolean>;
  /** Issues per check in the whole document (counted for every available check, on or off). */
  counts: Record<StyleCheck, number>;
  readability: Readability | null;
  /** A run is in progress (large documents are analyzed in idle-time chunks). */
  analyzing: boolean;
}

export interface StyleAnalysisCommands {
  setEnabled(on: boolean): void;
  toggle(): void;
  setCheck(check: StyleCheck, on: boolean): void;
  /** Selects the next highlighted issue after the caret (wrapping), optionally of one check only. */
  next(check?: StyleCheck): boolean;
  prev(check?: StyleCheck): boolean;
  /** Analyzes the whole document now, synchronously. */
  refresh(): void;
}

export type StyleAnalysisController = FeatureController<StyleAnalysisState, StyleAnalysisCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    styleAnalysis: StyleAnalysisController;
  }
}

/** Work per idle slice before yielding back to the browser… */
const SLICE_MS = 8;
/** …but at least this many textblocks, so short documents are always analyzed at once. */
const SLICE_MIN_BLOCKS = 50;

const zero = (): Record<StyleCheck, number> => ({ filler: 0, adverb: 0, repetition: 0, longSentence: 0, passive: 0 });

type Idle = (fn: () => void) => void;
const idle: Idle = (fn) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 500 });
  else setTimeout(fn, 1);
};

interface Range {
  check: StyleCheck;
  from: number;
  to: number;
}

/**
 * Style analysis: filler words, adverbs, repetitions, long sentences, passive voice and a readability
 * score, with a pluggable lexicon. Runs on the main thread, per textblock, cached by node identity
 * (ProseMirror keeps unchanged nodes), in idle-time slices after edits pause.
 */
export const styleAnalysis = (options: StyleAnalysisOptions): Feature<'styleAnalysis', StyleAnalysisController> => {
  const { lexicon, debounceMs = 300 } = options;
  const available = availableChecks(lexicon);

  return defineFeature({
    name: 'styleAnalysis',
    extensions: [Extension.create({ name: 'proselineStyleAnalysis', addProseMirrorPlugins: () => [stylePlugin()] })],
    messages: {
      en: {
        'styleAnalysis.title': 'Style', 'styleAnalysis.toggle': 'Highlight style issues', 'styleAnalysis.off': 'Turn on to see style issues.',
        'styleAnalysis.analyzing': 'Analyzing…', 'styleAnalysis.next': 'Next', 'styleAnalysis.prev': 'Previous',
        'styleAnalysis.check.filler': 'Filler words', 'styleAnalysis.check.adverb': 'Adverbs', 'styleAnalysis.check.repetition': 'Repetitions',
        'styleAnalysis.check.longSentence': 'Long sentences', 'styleAnalysis.check.passive': 'Passive voice',
        'styleAnalysis.tip.filler': 'Filler word', 'styleAnalysis.tip.adverb': 'Adverb', 'styleAnalysis.tip.repetition': 'Repeated: {word}',
        'styleAnalysis.tip.longSentence': 'Long sentence: {words} words', 'styleAnalysis.tip.passive': 'Passive voice',
        'styleAnalysis.readability': 'Readability', 'styleAnalysis.readabilityNone': 'Write a little more for a readability score.',
        'styleAnalysis.level.veryEasy': 'very easy', 'styleAnalysis.level.easy': 'easy', 'styleAnalysis.level.standard': 'standard',
        'styleAnalysis.level.fairlyHard': 'fairly hard', 'styleAnalysis.level.hard': 'hard', 'styleAnalysis.level.veryHard': 'very hard',
      },
      uk: {
        'styleAnalysis.title': 'Стиль', 'styleAnalysis.toggle': 'Підсвічувати стильові проблеми', 'styleAnalysis.off': 'Увімкніть, щоб побачити стильові проблеми.',
        'styleAnalysis.analyzing': 'Аналіз…', 'styleAnalysis.next': 'Наступна', 'styleAnalysis.prev': 'Попередня',
        'styleAnalysis.check.filler': 'Слова-паразити', 'styleAnalysis.check.adverb': 'Прислівники', 'styleAnalysis.check.repetition': 'Повтори',
        'styleAnalysis.check.longSentence': 'Довгі речення', 'styleAnalysis.check.passive': 'Пасивний стан',
        'styleAnalysis.tip.filler': 'Слово-паразит', 'styleAnalysis.tip.adverb': 'Прислівник', 'styleAnalysis.tip.repetition': 'Повтор: {word}',
        'styleAnalysis.tip.longSentence': 'Довге речення: {words} слів', 'styleAnalysis.tip.passive': 'Пасивний стан',
        'styleAnalysis.readability': 'Читабельність', 'styleAnalysis.readabilityNone': 'Напишіть трохи більше, щоб оцінити читабельність.',
        'styleAnalysis.level.veryEasy': 'дуже легко', 'styleAnalysis.level.easy': 'легко', 'styleAnalysis.level.standard': 'звичайно',
        'styleAnalysis.level.fairlyHard': 'досить складно', 'styleAnalysis.level.hard': 'складно', 'styleAnalysis.level.veryHard': 'дуже складно',
      },
      fr: {
        'styleAnalysis.title': 'Style', 'styleAnalysis.toggle': 'Surligner les problèmes de style', 'styleAnalysis.off': 'Activez pour voir les problèmes de style.',
        'styleAnalysis.analyzing': 'Analyse…', 'styleAnalysis.next': 'Suivant', 'styleAnalysis.prev': 'Précédent',
        'styleAnalysis.check.filler': 'Mots de remplissage', 'styleAnalysis.check.adverb': 'Adverbes', 'styleAnalysis.check.repetition': 'Répétitions',
        'styleAnalysis.check.longSentence': 'Phrases longues', 'styleAnalysis.check.passive': 'Voix passive',
        'styleAnalysis.tip.filler': 'Mot de remplissage', 'styleAnalysis.tip.adverb': 'Adverbe', 'styleAnalysis.tip.repetition': 'Répété : {word}',
        'styleAnalysis.tip.longSentence': 'Phrase longue : {words} mots', 'styleAnalysis.tip.passive': 'Voix passive',
        'styleAnalysis.readability': 'Lisibilité', 'styleAnalysis.readabilityNone': 'Écrivez un peu plus pour obtenir un score de lisibilité.',
        'styleAnalysis.level.veryEasy': 'très facile', 'styleAnalysis.level.easy': 'facile', 'styleAnalysis.level.standard': 'standard',
        'styleAnalysis.level.fairlyHard': 'assez difficile', 'styleAnalysis.level.hard': 'difficile', 'styleAnalysis.level.veryHard': 'très difficile',
      },
    },
    controller: ({ editor, t }) => {
      const checks = Object.fromEntries(STYLE_CHECKS.map((c) => [c, available.includes(c) && options.checks?.[c] !== false])) as Record<StyleCheck, boolean>;
      const state = createStore<StyleAnalysisState>({ enabled: options.enabled ?? false, available, checks, counts: zero(), readability: null, analyzing: false });
      // Per textblock node: its analysis and issue counts (ProseMirror reuses unchanged nodes).
      const cache = new WeakMap<PMNode, { result: TextAnalysis; counts: Record<StyleCheck, number> }>();
      let generation = 0;
      let debounce: ReturnType<typeof setTimeout> | null = null;
      let destroyed = false;

      const analyze = (node: PMNode) => {
        let entry = cache.get(node);
        if (!entry) {
          const result = analyzeText(blockText(node), lexicon, options);
          const counts = zero();
          for (const issue of result.issues) counts[issue.check]++;
          entry = { result, counts };
          cache.set(node, entry);
        }
        return entry;
      };

      const textblocks = (doc: PMNode) => {
        const out: { node: PMNode; pos: number }[] = [];
        doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;
          out.push({ node, pos });
          return false;
        });
        return out;
      };

      /** The textblocks of the last published document, and that document. */
      let blocks: { node: PMNode; pos: number }[] = [];
      let publishedDoc: PMNode | null = null;
      let decorated: { first: number; last: number } | null = null;

      /** Highlights the cached issues of the visible textblocks (plus a margin); all of them without layout. */
      const decorate = () => {
        const on = state.getState().checks;
        const window = visibleBlocks(editor.view, blocks.map((b) => b.pos)) ?? { first: 0, last: blocks.length - 1 };
        const decorations: Decoration[] = [];
        for (let i = window.first; i <= window.last; i++) {
          const { node, pos } = blocks[i]!;
          for (const issue of analyze(node).result.issues) {
            if (!on[issue.check]) continue;
            const title = t(`styleAnalysis.tip.${issue.check}`, { word: issue.word ?? '', words: issue.words ?? 0 });
            decorations.push(Decoration.inline(pos + 1 + issue.from, pos + 1 + issue.to, { class: `pl-style pl-style--${issue.check}`, title }));
          }
        }
        decorated = window;
        editor.view.dispatch(editor.state.tr.setMeta(styleKey, DecorationSet.create(editor.state.doc, decorations)).setMeta('addToHistory', false));
      };

      /** Counts and the readability score for the whole document, then highlights. */
      const publish = (current: { node: PMNode; pos: number }[]) => {
        const counts = zero();
        const totals = { words: 0, sentences: 0, syllables: 0 };
        blocks = current;
        for (const { node } of blocks) {
          const { result, counts: own } = analyze(node);
          totals.words += result.words;
          totals.sentences += result.sentences;
          totals.syllables += result.syllables;
          for (const check of STYLE_CHECKS) counts[check] += own[check];
        }
        decorate();
        state.setState({ counts, readability: readability(totals, lexicon), analyzing: false });
      };

      /** Re-highlights when scrolling brings textblocks outside the highlighted window into view. */
      let frame = 0;
      const onScroll = () => {
        if (frame || !decorated || !state.getState().enabled || state.getState().analyzing) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (destroyed || !decorated || editor.state.doc !== publishedDoc) return; // stale positions: the pending run re-highlights
          const now = visibleBlocks(editor.view, blocks.map((b) => b.pos));
          if (now && (now.first < decorated.first || now.last > decorated.last)) decorate();
        });
      };
      const clear = () => {
        generation++;
        blocks = [];
        decorated = null;
        editor.view.dispatch(editor.state.tr.setMeta(styleKey, DecorationSet.empty).setMeta('addToHistory', false));
        state.setState({ counts: zero(), readability: null, analyzing: false });
      };

      const refresh = () => {
        if (destroyed || !state.getState().enabled) return;
        generation++;
        publishedDoc = editor.state.doc;
        publish(textblocks(publishedDoc));
      };

      /** Analyzes uncached blocks in idle slices, then publishes; restarts if the document changed meanwhile. */
      const run = () => {
        const gen = ++generation;
        const doc = editor.state.doc;
        const pending = textblocks(doc);
        let i = 0;
        state.setState({ analyzing: true });
        const slice = () => {
          if (destroyed || gen !== generation) return;
          if (editor.state.doc !== doc) {
            run();
            return;
          }
          const end = performance.now() + SLICE_MS;
          const min = i + SLICE_MIN_BLOCKS;
          while (i < pending.length && (i < min || performance.now() < end)) analyze(pending[i++]!.node);
          if (i < pending.length) idle(slice);
          else {
            publishedDoc = doc;
            publish(pending);
          }
        };
        slice();
      };

      const schedule = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          debounce = null;
          if (!destroyed && state.getState().enabled) run();
        }, debounceMs);
      };

      const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
        if (transaction.docChanged && state.getState().enabled) schedule();
      };
      editor.on('transaction', onTransaction);
      document.addEventListener('scroll', onScroll, { capture: true, passive: true });
      window.addEventListener('resize', onScroll);

      const setEnabled = (on: boolean) => {
        if (on === state.getState().enabled) return;
        state.setState({ enabled: on });
        if (on) run();
        else clear();
      };

      /** Highlighted issues (optionally of one check) in document order; built on demand. */
      const issueRanges = (check?: StyleCheck): Range[] => {
        if (editor.state.doc !== publishedDoc) refresh(); // edits since the last run: positions moved
        const on = state.getState().checks;
        const list: Range[] = [];
        for (const { node, pos } of blocks) {
          for (const issue of analyze(node).result.issues) {
            if (on[issue.check] && (!check || issue.check === check)) list.push({ check: issue.check, from: pos + 1 + issue.from, to: pos + 1 + issue.to });
          }
        }
        return list.sort((a, b) => a.from - b.from);
      };

      const go = (dir: 1 | -1, check?: StyleCheck): boolean => {
        if (!state.getState().enabled) return false;
        const list = issueRanges(check);
        if (!list.length) return false;
        const { from } = editor.state.selection;
        const target = dir === 1 ? (list.find((r) => r.from > from) ?? list[0]!) : ([...list].reverse().find((r) => r.from < from) ?? list[list.length - 1]!);
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, target.from, target.to)).scrollIntoView());
        editor.view.focus();
        return true;
      };

      if (state.getState().enabled) run();

      return {
        getState: state.getState,
        subscribe: state.subscribe,
        commands: {
          setEnabled,
          toggle: () => setEnabled(!state.getState().enabled),
          setCheck: (check: StyleCheck, on: boolean) => {
            if (!available.includes(check)) return;
            state.setState({ checks: { ...state.getState().checks, [check]: on } });
            refresh();
          },
          next: (check?: StyleCheck) => go(1, check),
          prev: (check?: StyleCheck) => go(-1, check),
          refresh,
        },
        destroy: () => {
          destroyed = true;
          if (debounce) clearTimeout(debounce);
          editor.off('transaction', onTransaction);
          document.removeEventListener('scroll', onScroll, { capture: true });
          window.removeEventListener('resize', onScroll);
          if (frame) cancelAnimationFrame(frame);
        },
      };
    },
  });
};
