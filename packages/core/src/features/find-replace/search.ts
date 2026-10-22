import type { Node as PMNode } from '@tiptap/pm/model';

export interface SearchQuery {
  term: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface Match {
  from: number;
  to: number;
}

export type SearchError = 'invalidRegex';

/** Stands in for inline leaf nodes (hard breaks, mentions) so matches never span them. */
const LEAF = '\uFFFC';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildPattern = (query: SearchQuery): { pattern: RegExp | null; error: SearchError | null } => {
  if (!query.term) return { pattern: null, error: null };
  let source = query.regex ? query.term : escapeRegExp(query.term);
  if (query.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  try {
    return { pattern: new RegExp(source, query.caseSensitive ? 'gu' : 'giu'), error: null };
  } catch {
    return { pattern: null, error: 'invalidRegex' };
  }
};

/**
 * All matches in document order. Each textblock is flattened to a string in which every inline
 * child takes exactly its node size (text = one char per position, leaves = one LEAF char), so a
 * string index maps straight back to a document position.
 */
export const findMatches = (doc: PMNode, query: SearchQuery, within?: Match): Match[] => {
  const { pattern } = buildPattern(query);
  if (!pattern) return [];
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => {
      text += child.isText ? (child.text ?? '') : LEAF.repeat(child.nodeSize);
    });
    const start = pos + 1;
    pattern.lastIndex = 0;
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      if (m[0].length === 0) {
        pattern.lastIndex++;
        continue;
      }
      if (m[0].includes(LEAF)) continue;
      const match = { from: start + m.index, to: start + m.index + m[0].length };
      if (!within || (match.from >= within.from && match.to <= within.to)) matches.push(match);
    }
    return false;
  });
  return matches;
};

/** The text that replaces `matched`: literal in plain mode, `$1`-style groups expanded in regex mode. */
export const expandReplacement = (matched: string, query: SearchQuery, replacement: string): string => {
  if (!query.regex) return replacement;
  const { pattern } = buildPattern(query);
  if (!pattern) return replacement;
  return matched.replace(new RegExp(pattern.source, pattern.flags.replace('g', '')), replacement);
};
