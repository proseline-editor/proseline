import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { defineFeature, type Feature, type FeatureController } from '../../feature.js';
import { createStore } from '../../store.js';
import { caseOptions, mentionText, type CaseKey, type MentionEntity } from './name-forms.js';
import { createMentionNodeView, type MentionClick, type NodeViewBridge } from './node-view.js';
import type { MatchedMentionItem, MentionProvider } from './provider.js';
import { DISMISS, triggerKey, triggerPlugin, type MenuRect, type TriggerBridge, type TriggerMatch } from './trigger.js';

export { CASE_KEYS, caseOptions, isCaseKey, isStale, mentionText, type CaseKey, type MentionEntity, type NameForms } from './name-forms.js';
export { matchMentionItems, staticMentionProvider, type MatchedMentionItem, type MentionItem, type MentionProvider } from './provider.js';
export type { MenuRect } from './trigger.js';

export interface MentionsOptions {
  provider: MentionProvider;
  /** Character that opens the menu. Default `@`. */
  trigger?: string;
  /** Let writers switch a mention's case by clicking it. Default true. */
  allowCaseChange?: boolean;
  /**
   * Opens the entity in the host (e.g. its page). Called on Cmd/Ctrl-click, on a click in a read-only
   * editor, and from the case picker's Open item.
   */
  onOpen?: (mention: { id: string; kind: string | null }) => void;
}

export interface MentionMenuState {
  query: string;
  items: MatchedMentionItem[];
  selected: number;
  /** Cases the selected entity can be inserted in (null = nominative) and the current choice. */
  caseOptions: Array<CaseKey | null>;
  caseIndex: number;
  /** Viewport coordinates of the trigger character. */
  rect: MenuRect | null;
  loading: boolean;
}

export interface MentionPickerState {
  pos: number;
  id: string;
  kind: string | null;
  current: CaseKey | null;
  options: { case: CaseKey | null; text: string }[];
  rect: MenuRect;
  /** The host handles `onOpen`. */
  canOpen: boolean;
}

export interface MentionsState {
  menu: MentionMenuState | null;
  picker: MentionPickerState | null;
}

export interface MentionsCommands {
  /** Inserts the entity at `index` (default: the selected one) in `mentionCase` (default: the chosen case). */
  choose(index?: number, mentionCase?: CaseKey | null): boolean;
  select(index: number): void;
  setCase(index: number): void;
  dismiss(): void;
  pickCase(mentionCase: CaseKey | null): boolean;
  /** Opens the picker's entity through `onOpen`. */
  open(): void;
  closePicker(): void;
}

export type MentionsController = FeatureController<MentionsState, MentionsCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    mentions: MentionsController;
  }
}

const entityOf = (item: MatchedMentionItem | undefined): MentionEntity | null => (item ? { name: item.label, forms: item.forms ?? null } : null);

/** Index of the case a search hit matched, among the entity's usable cases. */
const matchedIndex = (item: MatchedMentionItem | undefined): number => Math.max(0, caseOptions(entityOf(item)).indexOf(item?.matchedCase ?? null));

/**
 * @-mentions of the host's entities: a menu that also matches case forms, insertion in a chosen
 * grammatical case, mentions rendered with the entity's current name (renames, deletions and
 * missing forms show live), and a picker to switch a mention's case.
 */
export const mentions = (options: MentionsOptions): Feature<'mentions', MentionsController> => {
  const { provider } = options;
  const trigger = options.trigger ?? '@';
  // Bridges between plugins built before the editor and the controller built after it.
  const triggerBridge: TriggerBridge = { onMatch: () => undefined, onKey: () => false };
  const viewBridge: NodeViewBridge = { provider, title: (kind) => (kind === 'detached' ? 'Deleted' : 'No such case form'), onClick: null, views: new Set() };

  return defineFeature({
    name: 'mentions',
    extensions: [
      Extension.create({
        name: 'proselineMentions',
        addProseMirrorPlugins: () => [
          triggerPlugin(trigger, triggerBridge),
          new Plugin({
            key: new PluginKey('proselineMentionViews'),
            props: { nodeViews: { mention: (node, view, getPos) => createMentionNodeView(node, view, getPos, viewBridge) } },
          }),
        ],
      }),
    ],
    messages: {
      en: {
        'mentions.label': 'Mentions', 'mentions.empty': 'No matches', 'mentions.loading': 'Searching…', 'mentions.pickCase': 'Case', 'mentions.changeCase': 'Change case', 'mentions.open': 'Open',
        'mentions.detached': 'This entity was deleted', 'mentions.noForm': 'No such case form — showing the name',
        'mentions.cases.nom': 'nominative', 'mentions.cases.gen': 'genitive', 'mentions.cases.dat': 'dative', 'mentions.cases.acc': 'accusative',
        'mentions.cases.ins': 'instrumental', 'mentions.cases.loc': 'locative', 'mentions.cases.voc': 'vocative',
        'mentions.kind.character': 'Characters', 'mentions.kind.location': 'Places', 'mentions.kind.faction': 'Factions',
      },
      uk: {
        'mentions.label': 'Згадки', 'mentions.empty': 'Нічого не знайдено', 'mentions.loading': 'Пошук…', 'mentions.pickCase': 'Відмінок', 'mentions.changeCase': 'Змінити відмінок', 'mentions.open': 'Відкрити',
        'mentions.detached': 'Цю сутність видалено', 'mentions.noForm': 'Немає цієї відмінкової форми — показано ім’я',
        'mentions.cases.nom': 'називний', 'mentions.cases.gen': 'родовий', 'mentions.cases.dat': 'давальний', 'mentions.cases.acc': 'знахідний',
        'mentions.cases.ins': 'орудний', 'mentions.cases.loc': 'місцевий', 'mentions.cases.voc': 'кличний',
        'mentions.kind.character': 'Персонажі', 'mentions.kind.location': 'Місця', 'mentions.kind.faction': 'Фракції',
      },
      fr: {
        'mentions.label': 'Mentions', 'mentions.empty': 'Aucun résultat', 'mentions.loading': 'Recherche…', 'mentions.pickCase': 'Cas', 'mentions.changeCase': 'Changer le cas', 'mentions.open': 'Ouvrir',
        'mentions.detached': 'Cette entité a été supprimée', 'mentions.noForm': 'Forme absente — le nom est affiché',
        'mentions.cases.nom': 'nominatif', 'mentions.cases.gen': 'génitif', 'mentions.cases.dat': 'datif', 'mentions.cases.acc': 'accusatif',
        'mentions.cases.ins': 'instrumental', 'mentions.cases.loc': 'locatif', 'mentions.cases.voc': 'vocatif',
        'mentions.kind.character': 'Personnages', 'mentions.kind.location': 'Lieux', 'mentions.kind.faction': 'Factions',
      },
    },
    controller: ({ editor, t }) => {
      const state = createStore<MentionsState>({ menu: null, picker: null });
      let match: TriggerMatch | null = null;
      let searchToken = 0;
      let destroyed = false;
      const set = (patch: Partial<MentionsState>) => !destroyed && state.setState(patch);
      const setMenu = (patch: Partial<MentionMenuState>) => {
        const menu = state.getState().menu;
        if (menu) set({ menu: { ...menu, ...patch } });
      };
      const withSelection = (items: MatchedMentionItem[], selected: number): Pick<MentionMenuState, 'items' | 'selected' | 'caseOptions' | 'caseIndex'> => ({
        items,
        selected,
        caseOptions: caseOptions(entityOf(items[selected])),
        caseIndex: matchedIndex(items[selected]),
      });

      const search = (query: string) => {
        const token = ++searchToken;
        const result = provider.search(query);
        if (Array.isArray(result)) {
          setMenu({ ...withSelection(result, 0), loading: false });
          return;
        }
        setMenu({ loading: true });
        void result.then(
          (items) => token === searchToken && setMenu({ ...withSelection(items, 0), loading: false }),
          () => token === searchToken && setMenu({ ...withSelection([], 0), loading: false }),
        );
      };

      triggerBridge.onMatch = (next, rect) => {
        const queryChanged = next?.query !== match?.query || !state.getState().menu;
        match = next;
        if (!next) {
          searchToken++;
          set({ menu: null });
          return;
        }
        const menu = state.getState().menu;
        set({ menu: { query: next.query, rect, loading: menu?.loading ?? false, ...(menu ? withSelection(menu.items, Math.min(menu.selected, Math.max(0, menu.items.length - 1))) : withSelection([], 0)) } });
        if (queryChanged) search(next.query);
      };

      const choose = (index?: number, mentionCase?: CaseKey | null): boolean => {
        const menu = state.getState().menu;
        if (!menu || !match) return false;
        const i = index ?? menu.selected;
        const item = menu.items[i];
        if (!item) return false;
        const c = mentionCase !== undefined ? mentionCase : (i === menu.selected ? menu.caseOptions[menu.caseIndex] : caseOptions(entityOf(item))[matchedIndex(item)]) ?? null;
        const label = mentionText(entityOf(item), c)?.text ?? item.label;
        const { schema } = editor.state;
        const node = schema.nodes.mention!.create({ id: item.id, label, kind: item.kind ?? null, case: c });
        const tr = editor.state.tr.replaceWith(match.from, match.to, [node, schema.text(' ')]);
        tr.setSelection(TextSelection.create(tr.doc, match.from + node.nodeSize + 1));
        editor.view.dispatch(tr);
        editor.view.focus();
        return true;
      };

      triggerBridge.onKey = (key) => {
        const menu = state.getState().menu;
        if (!menu) return false;
        const count = menu.items.length;
        switch (key) {
          case 'ArrowDown':
          case 'ArrowUp':
            if (!count) return false;
            setMenu(withSelection(menu.items, (menu.selected + (key === 'ArrowDown' ? 1 : -1) + count) % count));
            return true;
          case 'ArrowRight':
          case 'ArrowLeft':
            if (menu.caseOptions.length < 2) return false;
            setMenu({ caseIndex: (menu.caseIndex + (key === 'ArrowRight' ? 1 : -1) + menu.caseOptions.length) % menu.caseOptions.length });
            return true;
          case 'Enter':
          case 'Tab':
            return count ? choose() : false;
          case 'Escape':
            editor.view.dispatch(editor.state.tr.setMeta(DISMISS, true));
            return true;
          default:
            return false;
        }
      };

      viewBridge.title = (kind) => t(kind === 'detached' ? 'mentions.detached' : 'mentions.noForm');
      viewBridge.onClick = (click: MentionClick) => {
        const entity = provider.resolve(click.id);
        if (!entity) return;
        if (options.onOpen && (click.modifier || !click.editable)) {
          options.onOpen({ id: click.id, kind: click.kind });
          return;
        }
        if (!click.editable || options.allowCaseChange === false) return;
        set({
          picker: {
            pos: click.pos,
            id: click.id,
            kind: click.kind,
            current: (click.case as CaseKey | null) ?? null,
            options: caseOptions(entity).map((c) => ({ case: c, text: mentionText(entity, c)?.text ?? entity.name })),
            rect: click.rect,
            canOpen: !!options.onOpen,
          },
        });
      };

      // Views rendered before the controller existed used the fallback titles.
      viewBridge.views.forEach((render) => render());

      // The picker points at a position: close it when the document changes under it.
      const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
        if (transaction.docChanged && state.getState().picker) set({ picker: null });
      };
      editor.on('transaction', onTransaction);

      const pickCase = (c: CaseKey | null): boolean => {
        const picker = state.getState().picker;
        if (!picker) return false;
        const node = editor.state.doc.nodeAt(picker.pos);
        const option = picker.options.find((o) => o.case === c);
        set({ picker: null });
        if (!node || node.type.name !== 'mention' || node.attrs.id !== picker.id || !option) return false;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(picker.pos, undefined, { ...node.attrs, case: c, label: option.text }));
        return true;
      };

      return {
        getState: state.getState,
        subscribe: state.subscribe,
        commands: {
          choose,
          select: (index: number) => {
            const menu = state.getState().menu;
            if (menu && menu.items[index]) setMenu(withSelection(menu.items, index));
          },
          setCase: (index: number) => {
            const menu = state.getState().menu;
            if (menu && index >= 0 && index < menu.caseOptions.length) setMenu({ caseIndex: index });
          },
          dismiss: () => editor.view.dispatch(editor.state.tr.setMeta(DISMISS, true)),
          pickCase,
          open: () => {
            const picker = state.getState().picker;
            set({ picker: null });
            if (picker) options.onOpen?.({ id: picker.id, kind: picker.kind });
          },
          closePicker: () => set({ picker: null }),
        },
        destroy: () => {
          destroyed = true;
          editor.off('transaction', onTransaction);
          triggerBridge.onMatch = () => undefined;
          triggerBridge.onKey = () => false;
          viewBridge.onClick = null;
        },
      };
    },
  });
};

/** True while the editor shows an open mention menu (hosts can skip their own Enter/Escape handling). */
export const isMentionMenuOpen = (editor: Editor): boolean => !!triggerKey.getState(editor.state)?.match;
