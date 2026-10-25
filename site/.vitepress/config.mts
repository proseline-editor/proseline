import { defineConfig } from 'vitepress';

// GitHub Pages serves a project site under /<repository>/; the deploy workflow sets DOCS_BASE.
const base = process.env.DOCS_BASE ?? '/';

const reference = [
  ['core', '@proseline-editor/core'],
  ['react', '@proseline-editor/react'],
  ['vue', '@proseline-editor/vue'],
  ['sync', '@proseline-editor/sync'],
  ['sync-indexeddb', '@proseline-editor/sync-indexeddb'],
  ['sync-hocuspocus', '@proseline-editor/sync-hocuspocus'],
  ['export', '@proseline-editor/export'],
  ['lexicons', '@proseline-editor/lexicons'],
].map(([slug, text]) => ({ text, link: `/reference/${slug}` }));

export default defineConfig({
  title: 'Proseline',
  description: 'An embeddable editor for long-form prose: React, Vue or headless.',
  base,
  cleanUrls: true,
  lastUpdated: false,
  head: [['meta', { name: 'theme-color', content: '#0f766e' }]],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Playground', link: '/playground' },
      { text: 'Reference', link: '/reference/core' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Features', link: '/guide/features' },
            { text: 'Collaboration', link: '/guide/collaboration' },
            { text: 'Export and import', link: '/guide/export-import' },
            { text: 'Write a feature', link: '/guide/write-a-feature' },
            { text: 'Theming and languages', link: '/guide/theming-i18n' },
          ],
        },
      ],
      '/reference/': [{ text: 'API reference', items: reference }],
    },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/proseline-editor/proseline' },
      { icon: 'patreon', link: 'https://www.patreon.com/AndriiSlavnov', ariaLabel: 'Support Proseline on Patreon' },
    ],
    footer: {
      message: 'MIT licensed. Feedback and ideas: <a href="mailto:safilad@gmail.com">safilad@gmail.com</a>',
    },
  },
});
