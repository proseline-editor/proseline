/** Grammatical cases a mention can be written in; the nominative is the entity's name itself. */
export const CASE_KEYS = ['gen', 'dat', 'acc', 'ins', 'loc', 'voc'] as const;
export type CaseKey = (typeof CASE_KEYS)[number];

/** Case forms of an entity's name. `base` = the name they were written for (forms go stale on rename). */
export type NameForms = { base?: string } & Partial<Record<CaseKey, string>>;

/** What a mention needs to know about its entity. */
export interface MentionEntity {
  name: string;
  forms?: NameForms | null;
}

export const isCaseKey = (value: unknown): value is CaseKey => typeof value === 'string' && (CASE_KEYS as readonly string[]).includes(value);

/** Forms written for an older name no longer fit (the entity was renamed since). */
export const isStale = (forms: NameForms | null | undefined, name: string): boolean => !!forms?.base && forms.base !== name;

/**
 * The text a mention shows: the current name for the nominative, else the stored case form. A
 * missing or stale form falls back to the name and is flagged `missing` (the editor marks it).
 */
export const mentionText = (entity: MentionEntity | null | undefined, mentionCase: unknown): { text: string; missing: boolean } | null => {
  if (!entity) return null;
  if (!isCaseKey(mentionCase)) return { text: entity.name, missing: false };
  const form = isStale(entity.forms, entity.name) ? undefined : entity.forms?.[mentionCase]?.trim();
  return form ? { text: form, missing: false } : { text: entity.name, missing: true };
};

/** Cases an entity can be written in: the nominative (null) plus every case with a usable form. */
export const caseOptions = (entity: MentionEntity | null | undefined): Array<CaseKey | null> => {
  if (!entity?.forms || isStale(entity.forms, entity.name)) return [null];
  return [null, ...CASE_KEYS.filter((c) => entity.forms?.[c]?.trim())];
};
