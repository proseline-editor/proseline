import { defineComponent, h } from 'vue';

/** Icon button with an accessible name, pressed state and tooltip; the icon goes in the default slot. */
export const ToolbarButton = defineComponent({
  name: 'ToolbarButton',
  props: {
    label: { type: String, required: true },
    active: { type: Boolean, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: 'pl-button',
          'aria-label': props.label,
          title: props.label,
          'aria-pressed': props.active === undefined ? undefined : String(props.active),
          disabled: props.disabled,
          // Keep the editor selection: buttons must not steal focus on mousedown.
          onMousedown: (e: MouseEvent) => e.preventDefault(),
          onClick: () => emit('click'),
        },
        slots.default?.(),
      );
  },
});
