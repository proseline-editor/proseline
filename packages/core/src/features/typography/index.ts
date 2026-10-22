import { Extension, InputRule } from '@tiptap/core';
import { defineFeature, createEditorController, type Feature, type FeatureController } from '../../feature.js';
import { QUOTE_SETS, opensQuote, quoteStyleFor, type QuoteStyle } from './rules.js';

export type { QuoteStyle } from './rules.js';

export interface TypographyOptions {
  /** Quote style; defaults to the editor locale (uk/ru/be → «», fr → « », otherwise “”). */
  quotes?: QuoteStyle;
  /** `--` → em dash. Default true. */
  dashes?: boolean;
  /** `...` → ellipsis. Default true. */
  ellipsis?: boolean;
  /** French: narrow no-break space before `; : ! ?`. Default true when quotes are French. */
  frenchSpacing?: boolean;
}

export interface TypographyState {
  quotes: QuoteStyle;
  dashes: boolean;
  ellipsis: boolean;
  frenchSpacing: boolean;
}

export type TypographyController = FeatureController<TypographyState, Record<string, never>>;

declare module '../../index.js' {
  interface FeatureRegistry {
    typography: TypographyController;
  }
}

const NNBSP = '\u202F';

const buildRules = (settings: TypographyState): InputRule[] => {
  const q = QUOTE_SETS[settings.quotes];
  const rules: InputRule[] = [];

  if (settings.dashes) {
    rules.push(new InputRule({ find: /--$/, handler: ({ state, range }) => void state.tr.insertText('—', range.from, range.to) }));
  }
  if (settings.ellipsis) {
    rules.push(new InputRule({ find: /\.\.\.$/, handler: ({ state, range }) => void state.tr.insertText('…', range.from, range.to) }));
  }
  // TipTap 3 inserts the typed character first, so `range` ends right after it: replace just that
  // last character. match[1] is the character before the quote (undefined at block start).
  rules.push(
    new InputRule({
      find: /(?:^|([\s\S]))"$/,
      handler: ({ state, range, match }) => void state.tr.insertText(opensQuote(match[1]) ? q.open : q.close, range.to - 1, range.to),
    }),
    new InputRule({
      find: /(?:^|([\s\S]))'$/,
      handler: ({ state, range, match }) => {
        const open = q.singleOpen !== null && opensQuote(match[1]);
        state.tr.insertText(open ? (q.singleOpen as string) : q.singleClose, range.to - 1, range.to);
      },
    }),
  );
  if (settings.frenchSpacing) {
    rules.push(
      new InputRule({
        find: /[ \u00A0]([;:!?])$/,
        handler: ({ state, range, match }) => void state.tr.insertText(`${NNBSP}${match[1]}`, range.from, range.to),
      }),
    );
  }
  return rules;
};

/** Smart quotes, dashes, ellipses and French spacing as you type. Backspace right after undoes a replacement. */
export const typography = (options: TypographyOptions = {}): Feature<'typography', TypographyController> => {
  const resolve = (locale: string): TypographyState => {
    const quotes = options.quotes ?? quoteStyleFor(locale);
    return {
      quotes,
      dashes: options.dashes ?? true,
      ellipsis: options.ellipsis ?? true,
      frenchSpacing: options.frenchSpacing ?? quotes === 'fr',
    };
  };

  return defineFeature({
    name: 'typography',
    extensions: ({ locale }) => [
      Extension.create({
        name: 'proselineTypography',
        addInputRules: () => buildRules(resolve(locale)),
      }),
    ],
    controller: (ctx) => {
      const settings = resolve(ctx.t.locale);
      return createEditorController(ctx.editor, () => settings, {});
    },
  });
};
