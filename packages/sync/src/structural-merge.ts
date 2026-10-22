import * as Y from 'yjs';

/** Origin of the guard's own repairs (they are local changes and get sent like typing). */
export const STRUCTURAL_MERGE_ORIGIN = Symbol('proseline:structural-merge');

/** Inline leaf nodes (hard breaks, mentions) occupy one position, like ProseMirror. */
const LEAF = '\uFFFC';
const MAX_TRACKED = 5000;

/**
 * One piece of a block's inline content as it was before an incoming change:
 * - `live` — content everyone had;
 * - `lost` — this client's text that the change deleted without knowing it;
 * - `deleted` — text this client had already deleted (only its length survives garbage collection).
 */
type Run =
  | { kind: 'live'; text: string }
  | { kind: 'lost'; text: string; attrs: Record<string, unknown> }
  | { kind: 'deleted'; length: number };

const idKey = (id: Y.ID): string => `${id.client}:${id.clock}`;

const sameId = (a: Y.ID | null, b: Y.ID | null): boolean => (a === null || b === null ? a === b : Y.compareIDs(a, b));

const elementOf = (item: Y.Item | null | undefined): Y.XmlElement | null =>
  item?.content instanceof Y.ContentType && item.content.type instanceof Y.XmlElement ? item.content.type : null;

/** Clock ranges of text this client deleted itself (per item creator). */
const createDeletions = () => {
  const ranges = new Map<number, [number, number][]>();
  let count = 0;
  return {
    add: (item: Y.Item) => {
      const list = ranges.get(item.id.client) ?? [];
      list.push([item.id.clock, item.id.clock + item.length]);
      ranges.set(item.id.client, list);
      if (++count > MAX_TRACKED) {
        // Forget the oldest entries; very old deletions are known to every peer anyway.
        for (const l of ranges.values()) l.splice(0, Math.ceil(l.length / 2));
        count = [...ranges.values()].reduce((n, l) => n + l.length, 0);
      }
    },
    has: (item: Y.Item) =>
      (ranges.get(item.id.client) ?? []).some(([from, to]) => item.id.clock >= from && item.id.clock + item.length <= to),
  };
};

type Deletions = ReturnType<typeof createDeletions>;

/** The inline content of `block` right before transaction `tr`. */
const runsBefore = (block: Y.XmlElement, tr: Y.Transaction, me: number, deletions: Deletions): Run[] => {
  const runs: Run[] = [];
  const inTr = (item: Y.Item) => Y.isDeleted(tr.deleteSet, item.id);
  // Created by this very transaction: not part of what the block held before it.
  const isNew = (item: Y.Item) => item.id.clock >= (tr.beforeState.get(item.id.client) ?? 0);
  for (let child = block._start; child; child = child.right) {
    if ((child.deleted && !inTr(child)) || isNew(child) || !(child.content instanceof Y.ContentType)) continue;
    const type = child.content.type;
    if (!(type instanceof Y.XmlText)) {
      runs.push({ kind: 'live', text: LEAF });
      continue;
    }
    const attrs: Record<string, unknown> = {};
    for (let item = type._start; item; item = item.right) {
      if (isNew(item)) continue;
      if (item.deleted && !inTr(item)) {
        if (item.countable && deletions.has(item)) runs.push({ kind: 'deleted', length: item.length });
        continue;
      }
      if (item.content instanceof Y.ContentFormat) {
        if (item.content.value === null) delete attrs[item.content.key];
        else attrs[item.content.key] = item.content.value;
      } else if (item.content instanceof Y.ContentString) {
        if (item.id.client === me && inTr(item)) runs.push({ kind: 'lost', text: item.content.str, attrs: { ...attrs } });
        else runs.push({ kind: 'live', text: item.content.str });
      } else if (item.countable) {
        runs.push({ kind: 'live', text: LEAF.repeat(item.length) });
      }
    }
  }
  return runs;
};

/** Current inline text of a live block (text children + one LEAF per inline element). */
const liveText = (block: Y.XmlElement): string =>
  block
    .toArray()
    .map((child) =>
      child instanceof Y.XmlText
        ? child
            .toDelta()
            .map((op: { insert: unknown }) => (typeof op.insert === 'string' ? op.insert : LEAF))
            .join('')
        : LEAF,
    )
    .join('');

/** Whether `text` is what the author of the change saw; `withDeleted` = they had not seen our deletions. */
const matches = (text: string, runs: Run[], withDeleted: boolean): boolean => {
  let at = 0;
  for (const run of runs) {
    if (run.kind === 'live') {
      if (!text.startsWith(run.text, at)) return false;
      at += run.text.length;
    } else if (run.kind === 'deleted' && withDeleted) {
      at += run.length; // content is gone; only the length must line up
    }
  }
  return at === text.length;
};

/** XmlElements created by other clients in this transaction. */
const insertedElements = (doc: Y.Doc, tr: Y.Transaction, me: number): Y.Item[] => {
  const found: Y.Item[] = [];
  tr.afterState.forEach((clock, client) => {
    if (client === me) return;
    const before = tr.beforeState.get(client) ?? 0;
    if (clock <= before) return;
    const structs = doc.store.clients.get(client) ?? [];
    for (let i = Y.findIndexSS(structs, before); i < structs.length; i++) {
      const struct = structs[i];
      if (struct instanceof Y.Item && !struct.deleted && elementOf(struct)) found.push(struct);
    }
  });
  return found;
};

/** Inline position in a live block → the XmlText child and offset there. */
const locate = (block: Y.XmlElement, offset: number): { text: Y.XmlText; index: number } | null => {
  let acc = 0;
  for (const child of block.toArray()) {
    if (child instanceof Y.XmlText) {
      if (offset <= acc + child.length) return { text: child, index: offset - acc };
      acc += child.length;
    } else {
      acc += 1;
    }
  }
  return null;
};

type Op = { type: 'insert'; offset: number; text: string; attrs: Record<string, unknown> } | { type: 'delete'; offset: number; length: number };

interface Repair {
  target: Y.XmlElement;
  ops: Op[];
}

/**
 * Blocks the incoming change replaced (type change, wrap) that held this client's concurrent work:
 * text it typed (re-inserted) and text it deleted (deleted again from the copy).
 */
const findRepairs = (doc: Y.Doc, tr: Y.Transaction, me: number, deletions: Deletions): Repair[] => {
  const blocks: Y.XmlElement[] = [];
  Y.iterateDeletedStructs(tr, tr.deleteSet, (struct) => {
    const block = struct instanceof Y.Item ? elementOf(struct) : null;
    if (block) blocks.push(block);
  });
  if (!blocks.length) return [];

  const candidates = insertedElements(doc, tr, me)
    .map((item) => elementOf(item) as Y.XmlElement)
    .filter((el) => el.toArray().some((c) => c instanceof Y.XmlText));
  const used = new Set<Y.XmlElement>();
  const repairs: Repair[] = [];
  for (const block of blocks) {
    const runs = runsBefore(block, tr, me, deletions);
    if (!runs.some((r) => r.kind !== 'live')) continue;
    let target: Y.XmlElement | undefined;
    let withDeleted = true;
    for (const variant of [true, false]) {
      target = candidates.find((el) => !used.has(el) && matches(liveText(el), runs, variant));
      if (target) {
        withDeleted = variant;
        break;
      }
    }
    if (!target) continue; // deleted on purpose, or changed beyond recognition: leave it
    used.add(target);
    const ops: Op[] = [];
    let offset = 0;
    for (const run of runs) {
      if (run.kind === 'live') offset += run.text.length;
      else if (run.kind === 'lost') ops.push({ type: 'insert', offset, text: run.text, attrs: run.attrs });
      else if (withDeleted) {
        ops.push({ type: 'delete', offset, length: run.length });
        offset += run.length;
      }
    }
    if (ops.length) repairs.push({ target, ops });
  }
  return repairs;
};

/** `head` plus the following siblings that pass `member` and were inserted right after the previous one. */
const chainFrom = (head: Y.Item, member: (item: Y.Item) => boolean): Y.Item[] => {
  const chain = [head];
  for (let item = head.right; item; item = item.right) {
    const prev = chain[chain.length - 1] as Y.Item;
    if (!member(item)) continue;
    if (item.origin && Y.compareIDs(item.origin, prev.lastId)) chain.push(item);
  }
  return chain;
};

const sameBlocks = (a: Y.Item[], b: Y.Item[]): boolean =>
  a.length === b.length && a.every((item, i) => elementOf(item)?.toString() === elementOf(b[i])?.toString());

/**
 * Elements this client created to replace a block, which a co-author replaced identically at the
 * same moment (same insertion point, same blocks — e.g. the heading plus TipTap's trailing
 * paragraph). The client with the higher id drops its own copy, so exactly one survives.
 */
const findDuplicates = (doc: Y.Doc, tr: Y.Transaction, me: number, replacements: Set<string>): Y.Item[] => {
  const remoteNew = insertedElements(doc, tr, me);
  const remoteKeys = new Set(remoteNew.map((item) => idKey(item.id)));
  const isOwnReplacement = (item: Y.Item) => !item.deleted && item.id.client === me && replacements.has(idKey(item.id)) && !!elementOf(item);
  const drop: Y.Item[] = [];
  for (const head of remoteNew) {
    if (me < head.id.client) continue; // the other side drops theirs
    if (head.origin && remoteKeys.has(idKey(head.origin))) continue; // chain heads only
    const parent = head.parent;
    if (!(parent instanceof Y.AbstractType)) continue;
    let own: Y.Item | null = null;
    for (let item = parent._start; item; item = item.right) {
      if (item !== head && isOwnReplacement(item) && sameId(item.origin, head.origin) && sameId(item.rightOrigin, head.rightOrigin)) {
        own = item;
        break;
      }
    }
    if (!own) continue;
    const remoteChain = chainFrom(head, (item) => !item.deleted && item.id.client === head.id.client && remoteKeys.has(idKey(item.id)));
    const ownChain = chainFrom(own, isOwnReplacement);
    if (sameBlocks(remoteChain, ownChain)) drop.push(...ownChain);
  }
  return drop;
};

const applyOp = (target: Y.XmlElement, op: Op): void => {
  if (op.type === 'insert') {
    const spot = locate(target, op.offset);
    if (spot) spot.text.insert(spot.index, op.text, op.attrs);
    return;
  }
  let left = op.length;
  while (left > 0) {
    const spot = locate(target, op.offset);
    if (!spot || spot.index >= spot.text.length) return; // the rest is not text: stop
    const n = Math.min(left, spot.text.length - spot.index);
    spot.text.delete(spot.index, n);
    left -= n;
  }
};

/**
 * Repairs the ways ProseMirror↔Yjs loses work when a co-author changes a block's structure
 * (paragraph → heading, wrap in a quote, …), which the binding performs as delete + re-create
 * from the author's copy of the text:
 *
 * 1. Text this client typed into the old block concurrently is re-inserted into the replacement at
 *    the same place with the same formatting.
 * 2. Text this client deleted concurrently, which the copy brought back, is deleted again.
 * 3. When both writers made the identical change, the client with the higher id removes its copy.
 *
 * Only the client whose work was affected repairs it, so each repair happens exactly once. Blocks
 * deleted on purpose, or changed so their text no longer lines up, are left alone. Returns a
 * function that detaches the guard.
 */
export const guardStructuralMerges = (doc: Y.Doc): (() => void) => {
  const replacements = new Set<string>();
  const deletions = createDeletions();

  const recordLocal = (tr: Y.Transaction): void => {
    let deletedBlock = false;
    Y.iterateDeletedStructs(tr, tr.deleteSet, (struct) => {
      if (!(struct instanceof Y.Item)) return;
      if (elementOf(struct)) deletedBlock = true;
      else if (struct.countable && !(struct.content instanceof Y.ContentType)) deletions.add(struct);
    });
    if (!deletedBlock || tr.origin === STRUCTURAL_MERGE_ORIGIN) return;
    const before = tr.beforeState.get(doc.clientID) ?? 0;
    // Nothing created (a plain deletion): there is no replacement to remember — and findIndexSS
    // would throw for a clock past the end of the store.
    if ((tr.afterState.get(doc.clientID) ?? 0) <= before) return;
    const structs = doc.store.clients.get(doc.clientID) ?? [];
    for (let i = Y.findIndexSS(structs, before); i < structs.length; i++) {
      const struct = structs[i];
      if (struct instanceof Y.Item && elementOf(struct)) replacements.add(idKey(struct.id));
    }
    while (replacements.size > MAX_TRACKED) replacements.delete(replacements.values().next().value as string);
  };

  const onTransaction = (tr: Y.Transaction): void => {
    const me = doc.clientID;
    if (tr.local) {
      recordLocal(tr);
      return;
    }
    // Read everything now: deleted content is garbage-collected right after this event.
    const repairs = findRepairs(doc, tr, me, deletions);
    const duplicates = findDuplicates(doc, tr, me, replacements);
    if (!repairs.length && !duplicates.length) return;
    doc.transact(() => {
      for (const { target, ops } of repairs) {
        // Back to front, so earlier offsets stay valid; at equal offsets a delete precedes its insert.
        for (const op of [...ops].reverse()) applyOp(target, op);
      }
      for (const item of duplicates) {
        const parent = item.parent;
        const element = elementOf(item);
        if (!element || !(parent instanceof Y.XmlFragment) || item.deleted) continue;
        const index = parent.toArray().indexOf(element);
        if (index >= 0) parent.delete(index, 1);
      }
    }, STRUCTURAL_MERGE_ORIGIN);
  };

  doc.on('afterTransaction', onTransaction);
  return () => doc.off('afterTransaction', onTransaction);
};
