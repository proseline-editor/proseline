/** Built-in locales. Any BCP 47 tag works; strings fall back to English. */
export type Locale = 'en' | 'uk' | 'fr' | (string & {});

/** Flat key → template map. Templates use `{name}` placeholders. */
export type Messages = Record<string, string>;

/** Per-locale message bundles, as shipped by core and by each feature. */
export type MessageBundles = Partial<Record<Locale, Messages>>;

export interface Translator {
  (key: string, vars?: Record<string, string | number>): string;
  /** Looks up `${key}.${pluralCategory}` (e.g. `stats.words.few`), falling back to `${key}.other`. */
  plural(key: string, count: number, vars?: Record<string, string | number>): string;
  readonly locale: Locale;
}

const FALLBACK: Locale = 'en';

const interpolate = (template: string, vars: Record<string, string | number> = {}): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));

/**
 * Builds a translator from bundles in priority order (later wins), e.g.
 * `[coreMessages, ...featureMessages, { [locale]: hostOverrides }]`.
 */
export const createTranslator = (locale: Locale, bundles: MessageBundles[]): Translator => {
  const lookup = (key: string): string | undefined => {
    for (const loc of [locale, FALLBACK]) {
      for (let i = bundles.length - 1; i >= 0; i--) {
        const hit = bundles[i]?.[loc]?.[key];
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  };
  const rules = new Intl.PluralRules(locale);

  const t = ((key, vars) => interpolate(lookup(key) ?? key, vars)) as Translator;
  t.plural = (key, count, vars = {}) => {
    const template = lookup(`${key}.${rules.select(count)}`) ?? lookup(`${key}.other`) ?? key;
    return interpolate(template, { count, ...vars });
  };
  Object.defineProperty(t, 'locale', { value: locale });
  return t;
};
