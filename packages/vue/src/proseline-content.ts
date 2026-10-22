import { defineComponent, h, onMounted, ref } from 'vue';
import { useProseline } from './context.js';

/** The writing surface. Place it anywhere inside <ProselineEditor>; rendered by default when there is no slot content. */
export const ProselineContent = defineComponent({
  name: 'ProselineContent',
  setup() {
    const { tiptap } = useProseline();
    const host = ref<HTMLElement | null>(null);
    // The editor starts in a detached element (see core's createEditor); adopt its view here.
    onMounted(() => host.value?.append(tiptap.view.dom));
    return () => h('div', { ref: host, class: 'pl-content' });
  },
});
