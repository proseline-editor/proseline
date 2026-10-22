import { CASE_KEYS, isStale, type CaseKey, type MentionEntity, type NameForms } from './name-forms.js';

export interface MentionItem {
  id: string;
  label: string;
  /** Host-defined kind (character, place, …): groups the menu and is stored on the mention. */
  kind?: string;
  forms?: NameForms | null;
}

/** A search hit plus the case its query matched (null = the name itself). */
export type MatchedMentionItem = MentionItem & { matchedCase: CaseKey | null };

/** Where mentions get their entities. Implemented by the host. */
export interface MentionProvider {
  /** Candidates for the @ menu. */
  search(query: string): MatchedMentionItem[] | Promise<MatchedMentionItem[]>;
  /** Current name and forms, or null when the entity no longer exists. Must be synchronous (rendering). */
  resolve(id: string): MentionEntity | null;
  /** False until the entities are known — mentions are not marked deleted before that. Default true. */
  isReady?(): boolean;
  /** Call `onChange` when entities change (renames, new forms, deletions). */
  subscribe?(onChange: () => void): () => void;
}

/**
 * Candidates whose name or any (non-stale) case form contains the query, so typing «Ґордієві» finds
 * the dative directly. The name wins over forms when both match.
 */
export const matchMentionItems = (items: MentionItem[], query: string, limit = 10): MatchedMentionItem[] => {
  const q = query.trim().toLowerCase();
  const out: MatchedMentionItem[] = [];
  for (const item of items) {
    if (out.length >= limit) break;
    if (!q || item.label.toLowerCase().includes(q)) {
      out.push({ ...item, matchedCase: null });
      continue;
    }
    if (!item.forms || isStale(item.forms, item.label)) continue;
    const hit = CASE_KEYS.find((c) => item.forms?.[c]?.toLowerCase().includes(q));
    if (hit) out.push({ ...item, matchedCase: hit });
  }
  return out;
};

/** A MentionProvider over an in-memory list — for hosts that already hold their entities, tests and demos. */
export const staticMentionProvider = (initial: MentionItem[] = []): MentionProvider & { setItems(items: MentionItem[]): void } => {
  let items = initial;
  let byId = new Map(items.map((i) => [i.id, i]));
  const listeners = new Set<() => void>();
  return {
    search: (query) => matchMentionItems(items, query),
    resolve: (id) => {
      const item = byId.get(id);
      return item ? { name: item.label, forms: item.forms ?? null } : null;
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    setItems: (next) => {
      items = next;
      byId = new Map(items.map((i) => [i.id, i]));
      listeners.forEach((l) => l());
    },
  };
};
