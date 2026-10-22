import type { Node as PMNode } from '@tiptap/pm/model';
import { countTextWords } from '../../words.js';

export type EditOp = '=' | '-' | '+';

/**
 * Myers' O((N+M)·D) shortest edit script: '=' keep, '-' delete from `a`, '+' insert from `b`.
 * Fast when the inputs are mostly alike, which versions of one document are.
 */
export const myers = <T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = Object.is): EditOp[] => {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max + 1;
  let v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    const next = v.slice();
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && eq(a[x]!, b[y]!)) {
        x++;
        y++;
      }
      next[offset + k] = x;
      if (x >= n && y >= m) {
        trace.push(next);
        return backtrack(trace, n, m, offset);
      }
    }
    v = next;
  }
  return [];
};

const backtrack = (trace: Int32Array[], n: number, m: number, offset: number): EditOp[] => {
  const ops: EditOp[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 2; d >= 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : v[offset + prevK]!;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push('=');
      x--;
      y--;
    }
    if (d > 0) ops.push(x === prevX ? '+' : '-');
    x = prevX;
    y = prevY;
  }
  return ops.reverse();
};

/** Words (with inner apostrophes), runs of whitespace and single punctuation marks. */
export const tokenize = (text: string): string[] => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|\s+|[^\s\p{L}\p{N}]/gu) ?? [];

export interface DiffPart {
  op: 'equal' | 'insert' | 'delete';
  text: string;
}

export interface DiffBlock {
  status: 'equal' | 'changed' | 'inserted' | 'deleted';
  /** Node type of the block (in the newer document for changed blocks). */
  kind: string;
  level?: number;
  /** Enclosing block (blockquote, bulletList, …) when not at the top level. */
  container?: string;
  parts: DiffPart[];
}

interface Block {
  kind: string;
  level?: number;
  container?: string;
  text: string;
}

const blocksOf = (doc: PMNode): Block[] => {
  const blocks: Block[] = [];
  doc.descendants((node, _pos, parent) => {
    const container = parent && parent !== doc && parent.type.name !== 'listItem' ? parent.type.name : undefined;
    const listContainer = parent?.type.name === 'listItem' ? 'listItem' : container;
    if (node.isTextblock) {
      const text = node.textBetween(0, node.content.size, '', (leaf) => (leaf.type.name === 'hardBreak' ? '\n' : (leaf.type.spec.leafText?.(leaf) ?? '\uFFFC')));
      blocks.push({ kind: node.type.name, ...(node.type.name === 'heading' ? { level: Number(node.attrs.level) } : {}), ...(listContainer ? { container: listContainer } : {}), text });
      return false;
    }
    if (node.isLeaf && node.isBlock) blocks.push({ kind: node.type.name, text: node.type.name === 'horizontalRule' ? '* * *' : '', ...(container ? { container } : {}) });
    return true;
  });
  return blocks;
};

const keyOf = (b: Block) => `${b.kind}|${b.level ?? ''}|${b.container ?? ''}|${b.text}`;

const shape = (b: Block): Omit<DiffBlock, 'status' | 'parts'> => ({
  kind: b.kind,
  ...(b.level !== undefined ? { level: b.level } : {}),
  ...(b.container !== undefined ? { container: b.container } : {}),
});

/**
 * Semantic cleanup (as in diff-match-patch): an unchanged run of only whitespace between two
 * changes is folded into them, and each run of changes is shown as one deletion then one
 * insertion — "three days" → "a whole week" instead of "three|a days|whole week".
 */
const cleanup = (parts: DiffPart[]): DiffPart[] => {
  const out: DiffPart[] = [];
  let deleted = '';
  let inserted = '';
  let carry = ''; // common tail of a change, handed to the next unchanged part
  const pushEqual = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last?.op === 'equal') last.text += text;
    else out.push({ op: 'equal', text });
  };
  const flush = () => {
    // Text both sides share at the edges of a change is unchanged: move it back out.
    let head = 0;
    while (head < deleted.length && head < inserted.length && deleted[head] === inserted[head]) head++;
    let tail = 0;
    while (tail < deleted.length - head && tail < inserted.length - head && deleted[deleted.length - 1 - tail] === inserted[inserted.length - 1 - tail]) tail++;
    pushEqual(deleted.slice(0, head));
    const del = deleted.slice(head, deleted.length - tail);
    const ins = inserted.slice(head, inserted.length - tail);
    if (del) out.push({ op: 'delete', text: del });
    if (ins) out.push({ op: 'insert', text: ins });
    carry = deleted.slice(deleted.length - tail);
    deleted = '';
    inserted = '';
  };
  parts.forEach((part, i) => {
    const between = part.op === 'equal' && /^\s+$/.test(part.text) && (deleted || inserted) && parts[i + 1] && parts[i + 1]!.op !== 'equal';
    if (part.op === 'delete' || between) deleted += part.text;
    if (part.op === 'insert' || between) inserted += part.text;
    if (part.op === 'equal' && !between) {
      flush();
      pushEqual(carry + part.text);
      carry = '';
    }
  });
  flush();
  pushEqual(carry);
  return out;
};

/** Word-level diff of one block's text, adjacent parts with the same op merged. */
const diffText = (before: string, after: string): DiffPart[] => {
  const a = tokenize(before);
  const b = tokenize(after);
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  const push = (op: DiffPart['op'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) last.text += text;
    else parts.push({ op, text });
  };
  for (const op of myers(a, b)) {
    if (op === '=') {
      push('equal', a[i++]!);
      j++;
    } else if (op === '-') push('delete', a[i++]!);
    else push('insert', b[j++]!);
  }
  return cleanup(parts);
};

/**
 * What changed from `before` to `after`, block by block: blocks are aligned first (identical ones
 * match), changed runs are paired up in order and diffed word by word, leftovers are whole
 * insertions or deletions.
 */
export const diffDocs = (before: PMNode, after: PMNode): DiffBlock[] => {
  const a = blocksOf(before);
  const b = blocksOf(after);
  const ops = myers(a.map(keyOf), b.map(keyOf));
  const out: DiffBlock[] = [];
  let i = 0;
  let j = 0;
  let deleted: Block[] = [];
  let inserted: Block[] = [];
  const flush = () => {
    const pairs = Math.min(deleted.length, inserted.length);
    for (let p = 0; p < pairs; p++) out.push({ status: 'changed', ...shape(inserted[p]!), parts: diffText(deleted[p]!.text, inserted[p]!.text) });
    for (const blk of deleted.slice(pairs)) out.push({ status: 'deleted', ...shape(blk), parts: [{ op: 'delete', text: blk.text }] });
    for (const blk of inserted.slice(pairs)) out.push({ status: 'inserted', ...shape(blk), parts: [{ op: 'insert', text: blk.text }] });
    deleted = [];
    inserted = [];
  };
  for (const op of ops) {
    if (op === '=') {
      flush();
      const blk = b[j++]!;
      i++;
      out.push({ status: 'equal', ...shape(blk), parts: [{ op: 'equal', text: blk.text }] });
    } else if (op === '-') deleted.push(a[i++]!);
    else inserted.push(b[j++]!);
  }
  flush();
  return out;
};

export const diffSummary = (blocks: DiffBlock[]): { insertedWords: number; deletedWords: number } => {
  let insertedWords = 0;
  let deletedWords = 0;
  for (const block of blocks) {
    for (const part of block.parts) {
      if (part.op === 'insert') insertedWords += countTextWords(part.text);
      if (part.op === 'delete') deletedWords += countTextWords(part.text);
    }
  }
  return { insertedWords, deletedWords };
};
