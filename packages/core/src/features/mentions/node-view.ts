import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import { mentionText } from './name-forms.js';
import type { MentionProvider } from './provider.js';
import type { MenuRect } from './trigger.js';

export interface MentionClick {
  pos: number;
  id: string;
  kind: string | null;
  case: string | null;
  rect: MenuRect;
  /** Cmd/Ctrl was held. */
  modifier: boolean;
  editable: boolean;
}

export interface NodeViewBridge {
  provider: MentionProvider;
  /** Translated tooltip for a deleted entity / a missing case form. */
  title(kind: 'detached' | 'noForm'): string;
  onClick: ((click: MentionClick) => void) | null;
  /** Live views, re-rendered when the bridge changes after they were created. */
  views: Set<() => void>;
}

/**
 * Renders a mention with its entity's *current* name (in the mention's case) instead of the stored
 * label, so renames show everywhere without rewriting the document. Unknown ids render the stored
 * label marked as detached; a missing or stale case form shows the name, marked.
 */
export const createMentionNodeView = (initial: PMNode, view: EditorView, getPos: () => number | undefined, bridge: NodeViewBridge): NodeView => {
  let node = initial;
  const dom = document.createElement('span');

  const render = () => {
    const id = node.attrs.id ? String(node.attrs.id) : '';
    const shown = mentionText(id ? bridge.provider.resolve(id) : null, node.attrs.case);
    const detached = (bridge.provider.isReady?.() ?? true) && shown === null;
    dom.textContent = shown?.text ?? String(node.attrs.label ?? '');
    dom.className = ['pl-mention', detached && 'pl-mention--detached', shown?.missing && 'pl-mention--noform'].filter(Boolean).join(' ');
    dom.setAttribute('data-mention-id', id);
    if (node.attrs.kind) dom.setAttribute('data-kind', String(node.attrs.kind));
    else dom.removeAttribute('data-kind');
    const title = detached ? bridge.title('detached') : shown?.missing ? bridge.title('noForm') : '';
    if (title) dom.title = title;
    else dom.removeAttribute('title');
  };

  const onClick = (event: MouseEvent) => {
    const pos = getPos();
    const id = node.attrs.id ? String(node.attrs.id) : '';
    if (!bridge.onClick || pos === undefined || !id || !bridge.provider.resolve(id)) return;
    const { left, top, bottom } = dom.getBoundingClientRect();
    bridge.onClick({
      pos,
      id,
      kind: (node.attrs.kind as string | null) ?? null,
      case: (node.attrs.case as string | null) ?? null,
      rect: { left, top, bottom },
      modifier: event.metaKey || event.ctrlKey,
      editable: view.editable,
    });
  };

  render();
  bridge.views.add(render);
  dom.addEventListener('click', onClick);
  const unsubscribe = bridge.provider.subscribe?.(render);

  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      render();
      return true;
    },
    ignoreMutation: () => true,
    destroy: () => {
      unsubscribe?.();
      bridge.views.delete(render);
      dom.removeEventListener('click', onClick);
    },
  };
};
