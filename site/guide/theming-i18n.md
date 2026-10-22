# Theming and languages

## Theme

Import `theme.css` from the adapter (`@proseline-editor/react/theme.css` or `@proseline-editor/vue/theme.css`; they are
the same file) and adjust it with CSS custom properties on `.pl-root` or any ancestor:

```css
.my-editor .pl-root {
  --pl-font: 'Literata', Georgia, serif;
  --pl-font-size: 1.2rem;
  --pl-line-height: 1.8;
  --pl-measure: 64ch;      /* line length */
  --pl-indent: 2em;        /* first-line indent */
  --pl-accent: #7c3aed;
}
```

Other properties: `--pl-ui-font`, `--pl-paragraph-gap`, `--pl-bg`, `--pl-fg`, `--pl-muted`, `--pl-border`,
`--pl-surface`, `--pl-accent-fg`, the find highlights (`--pl-match`, `--pl-match-current`), comments
(`--pl-comment`, `--pl-comment-line`, `--pl-comment-active`) and style analysis (`--pl-style-*`).

Dark mode follows the system; force a scheme with `data-theme="light"` or `data-theme="dark"` on `.pl-root`. To style
everything yourself, skip `theme.css`: the components only use class names (`pl-toolbar`, `pl-content`, …).

## Languages

UI strings ship in English (`en`), Ukrainian (`uk`) and French (`fr`). Pass `locale` to the editor; typography,
quotes and plural forms follow it.

```tsx
<ProselineEditor locale="uk" messages={{ 'toolbar.bold': 'Напівжирний' }} features={[...]}>
```

`messages` overrides any string for the current locale. For another language, pass all strings through `messages`
(the keys are listed in each feature's source); anything missing falls back to English. Style analysis has its own
lexicons per language (`@proseline-editor/lexicons`).
