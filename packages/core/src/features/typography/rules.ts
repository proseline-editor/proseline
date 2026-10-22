export type QuoteStyle = 'en' | 'uk' | 'fr';

interface QuoteSet {
  open: string;
  close: string;
  /** Replacement for a typed `'` that opens a nested quote; null = always an apostrophe. */
  singleOpen: string | null;
  singleClose: string;
}

const NNBSP = '\u202F';

export const QUOTE_SETS: Record<QuoteStyle, QuoteSet> = {
  en: { open: '“', close: '”', singleOpen: '‘', singleClose: '’' },
  uk: { open: '«', close: '»', singleOpen: null, singleClose: '’' },
  fr: { open: `«${NNBSP}`, close: `${NNBSP}»`, singleOpen: null, singleClose: '’' },
};

/** Locale tag → quote style. Unknown locales use English quotes. */
export const quoteStyleFor = (locale: string): QuoteStyle => {
  const lang = locale.toLowerCase().split('-')[0];
  if (lang === 'uk' || lang === 'ru' || lang === 'be') return 'uk';
  if (lang === 'fr') return 'fr';
  return 'en';
};

/** A quote typed at the start, after whitespace, or after an opening bracket/dash/quote opens. */
export const opensQuote = (before: string | undefined): boolean =>
  before === undefined || before === '' || /[\s([{—–«„“‘-]/u.test(before);
