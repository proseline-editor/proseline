import { defineComponent, h, onBeforeUnmount, onMounted, provide, shallowRef, watch, type PropType } from 'vue';
import type { AnyExtension, Content } from '@tiptap/core';
import { createEditor, type AnyFeature, type Messages, type ProselineEditor as Editor } from '@proseline-editor/core';
import { PROSELINE } from './context.js';
import { ProselineContent } from './proseline-content.js';

/**
 * Creates the editor and provides it to child components. Configuration is read once on mount;
 * only `editable` is applied live. Emits `ready` (the editor) and `change` (debounced).
 */
export const ProselineEditor = defineComponent({
  name: 'ProselineEditor',
  props: {
    content: { type: [String, Object] as PropType<Content>, default: undefined },
    editable: { type: Boolean, default: true },
    locale: { type: String, default: undefined },
    messages: { type: Object as PropType<Messages>, default: undefined },
    placeholder: { type: String, default: undefined },
    features: { type: Array as PropType<AnyFeature[]>, default: undefined },
    extensions: { type: Array as PropType<AnyExtension[]>, default: undefined },
    changeDebounceMs: { type: Number, default: undefined },
    onError: { type: Function as PropType<(error: unknown) => void>, default: undefined },
  },
  emits: {
    ready: (_editor: Editor) => true,
    change: (_editor: Editor) => true,
  },
  setup(props, { emit, slots }) {
    const editor = shallowRef<Editor | null>(null);
    const distractionFree = shallowRef(false);
    provide(PROSELINE, editor);
    let unsubscribe: (() => void) | undefined;

    onMounted(() => {
      const instance = createEditor({
        content: props.content,
        editable: props.editable,
        locale: props.locale,
        messages: props.messages,
        placeholder: props.placeholder,
        features: props.features,
        extensions: props.extensions,
        changeDebounceMs: props.changeDebounceMs,
        onError: props.onError,
        onChange: (e) => emit('change', e),
      });
      const focus = instance.feature('focus');
      if (focus) unsubscribe = focus.subscribe(() => (distractionFree.value = focus.getState().distractionFree));
      editor.value = instance;
      emit('ready', instance);
    });
    onBeforeUnmount(() => {
      unsubscribe?.();
      editor.value?.destroy();
      editor.value = null;
    });
    watch(
      () => props.editable,
      (editable) => {
        if (editor.value && editor.value.isEditable !== editable) editor.value.setEditable(editable);
      },
    );

    return () =>
      editor.value
        ? h('div', { class: 'pl-root', 'data-distraction-free': distractionFree.value || undefined }, slots.default?.() ?? [h(ProselineContent)])
        : h('div', { class: 'pl-root', 'aria-busy': 'true' });
  },
});
