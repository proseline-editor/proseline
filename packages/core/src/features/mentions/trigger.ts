import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface TriggerMatch {
  /** Position of the trigger character. */
  from: number;
  /** The caret. */
  to: number;
  query: string;
}

export interface MenuRect {
  left: number;
  top: number;
  bottom: number;
}

interface TriggerState {
  match: TriggerMatch | null;
  /** The match the writer dismissed with Escape; it stays closed until the caret leaves it. */
  dismissed: number | null;
}

export interface TriggerBridge {
  onMatch(match: TriggerMatch | null, rect: MenuRect | null): void;
  onKey(key: string): boolean;
}

export const triggerKey = new PluginKey<TriggerState>('proselineMentionTrigger');
export const DISMISS = 'proselineMentionTrigger:dismiss';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `@query` right before an empty selection, where `@` starts a word (not an e-mail address). */
const findMatch = (state: EditorState, trigger: string): TriggerMatch | null => {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uFFFC');
  const t = escapeRe(trigger);
  const m = new RegExp(`(?:^|[\\s(«"“'])${t}([^\\s${t}\\uFFFC]{0,40})$`, 'u').exec(before);
  if (!m) return null;
  const query = m[1] ?? '';
  return { from: $from.pos - query.length - trigger.length, to: $from.pos, query };
};

const rectAt = (view: EditorView, pos: number): MenuRect | null => {
  try {
    const { left, top, bottom } = view.coordsAtPos(pos);
    return { left, top, bottom };
  } catch {
    return null; // no layout
  }
};

/** Tracks a `@query` before the caret and hands keys to the menu while it is open. */
export const triggerPlugin = (trigger: string, bridge: TriggerBridge): Plugin<TriggerState> =>
  new Plugin<TriggerState>({
    key: triggerKey,
    state: {
      init: () => ({ match: null, dismissed: null }),
      apply: (tr, prev, _old, state) => {
        const found = findMatch(state, trigger);
        if (tr.getMeta(DISMISS)) return { match: null, dismissed: found?.from ?? null };
        if (!found) return { match: null, dismissed: null };
        if (found.from === prev.dismissed) return { match: null, dismissed: prev.dismissed };
        return { match: found, dismissed: null };
      },
    },
    props: {
      handleKeyDown: (view, event) => (triggerKey.getState(view.state)?.match ? bridge.onKey(event.key) : false),
    },
    view: () => {
      let last: TriggerMatch | null = null;
      return {
        update: (view) => {
          const match = triggerKey.getState(view.state)?.match ?? null;
          if (match?.from === last?.from && match?.query === last?.query) return;
          last = match;
          bridge.onMatch(match, match ? rectAt(view, match.from) : null);
        },
      };
    },
  });
