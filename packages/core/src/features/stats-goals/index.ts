import { defineFeature, createEditorController, type Feature, type FeatureController } from '../../feature.js';

export interface StatsOptions {
  /** Document word goal. */
  goal?: number | null;
  /** Words to type in this session. */
  sessionGoal?: number | null;
  /** Manuscript page estimate. Default 250 (standard manuscript format). */
  wordsPerPage?: number;
  /** Reading speed. Default 230. */
  wordsPerMinute?: number;
}

export interface StatsState {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  pages: number;
  readingMinutes: number;
  goal: number | null;
  /** 0…1, null without a goal. */
  goalProgress: number | null;
  /** Net words the local writer typed since the editor opened (or the last reset). */
  sessionWords: number;
  sessionGoal: number | null;
  sessionProgress: number | null;
}

export interface StatsCommands {
  setGoal(goal: number | null): void;
  setSessionGoal(goal: number | null): void;
  resetSession(): void;
}

export type StatsController = FeatureController<StatsState, StatsCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    stats: StatsController;
  }
}

const progress = (value: number, goal: number | null): number | null =>
  goal && goal > 0 ? Math.min(1, Math.max(0, value) / goal) : null;

/** Live word/character/page counts, reading time, document and session goals. */
export const stats = (options: StatsOptions = {}): Feature<'stats', StatsController> =>
  defineFeature({
    name: 'stats',
    messages: {
      en: {
        'stats.words.one': '{count} word', 'stats.words.other': '{count} words',
        'stats.characters': '{count} characters', 'stats.pages': '~{count} pp.', 'stats.reading': '{count} min read',
        'stats.goal': '{value} / {goal}', 'stats.session': 'Today: {count}',
      },
      uk: {
        'stats.words.one': '{count} слово', 'stats.words.few': '{count} слова', 'stats.words.many': '{count} слів', 'stats.words.other': '{count} слова',
        'stats.characters': '{count} знаків', 'stats.pages': '~{count} стор.', 'stats.reading': '{count} хв читання',
        'stats.goal': '{value} / {goal}', 'stats.session': 'Сьогодні: {count}',
      },
      fr: {
        'stats.words.one': '{count} mot', 'stats.words.many': '{count} mots', 'stats.words.other': '{count} mots',
        'stats.characters': '{count} caractères', 'stats.pages': '~{count} p.', 'stats.reading': '{count} min de lecture',
        'stats.goal': '{value} / {goal}', 'stats.session': 'Aujourd’hui : {count}',
      },
    },
    controller: (ctx) => {
      const wordsPerPage = options.wordsPerPage ?? 250;
      const wordsPerMinute = options.wordsPerMinute ?? 230;
      let goal = options.goal ?? null;
      let sessionGoal = options.sessionGoal ?? null;
      let sessionWords = 0;

      const compute = (): StatsState => {
        const counts = ctx.countDoc();
        return {
          ...counts,
          pages: Math.ceil(counts.words / wordsPerPage),
          readingMinutes: Math.ceil(counts.words / wordsPerMinute),
          goal,
          goalProgress: progress(counts.words, goal),
          sessionWords,
          sessionGoal,
          sessionProgress: progress(sessionWords, sessionGoal),
        };
      };

      const controller = createEditorController(ctx.editor, compute, {
        setGoal: (next: number | null) => {
          goal = next;
          refresh();
        },
        setSessionGoal: (next: number | null) => {
          sessionGoal = next;
          refresh();
        },
        resetSession: () => {
          sessionWords = 0;
          refresh();
        },
      });
      // Commands change closure state, not the editor, so recompute explicitly.
      const refresh = () => controller.refresh();
      const offTyped = ctx.on('wordsTyped', ({ delta }) => {
        sessionWords += delta;
        refresh();
      });
      return { ...controller, destroy: () => (offTyped(), controller.destroy()) };
    },
  });
