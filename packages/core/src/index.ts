// Keep TipTap's command typings (toggleBold, setTextAlign, undo, …) in the published declarations,
// so consumers get typed `editor.tiptap.chain()` commands without depending on these packages.
/// <reference types="@tiptap/starter-kit" preserve="true" />
/// <reference types="@tiptap/extension-text-align" preserve="true" />
export { createEditor, type ProselineConfig, type ProselineEditor } from './editor.js';
export {
  defineFeature,
  createEditorController,
  type AnyFeature,
  type Feature,
  type FeatureContext,
  type FeatureEnv,
  type FeatureController,
  type ProselineEvents,
} from './feature.js';
export { createStore, type ReadableStore, type Store } from './store.js';
export { coreMessages } from './locales.js';
export { createTranslator, type Locale, type Messages, type MessageBundles, type Translator } from './i18n.js';
export { countTextWords, NO_WORD_COUNT, type DocCounts } from './words.js';
export { proseExtensions, type ProseExtensionOptions } from './schema/extensions.js';
export { ProseParagraph, PARAGRAPH_STYLES, isParagraphStyle, type ParagraphStyleName } from './schema/paragraph.js';
export { LegacyCommentMark, legacyCommentAnchors, type LegacyCommentAnchor } from './schema/legacy-comment.js';
export { MentionNode } from './schema/mention.js';
export { cleanPastedHTML, isBreakMark } from './schema/paste.js';
export { relativeTime } from './relative-time.js';

/**
 * Maps feature names to controller types. Each feature augments it:
 * `declare module '@proseline-editor/core' { interface FeatureRegistry { stats: StatsController } }`
 *
 * Declared here, in the package entry, rather than re-exported: TypeScript applies augmentations of a
 * re-exported interface depending on file order, so they could silently go missing.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureRegistry {}
