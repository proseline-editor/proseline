import type { MessageBundles } from './i18n.js';

/** Strings for UI shared by every adapter (toolbar). Features ship their own. */
export const coreMessages: MessageBundles = {
  en: {
    'toolbar.label': 'Formatting', 'toolbar.undo': 'Undo', 'toolbar.redo': 'Redo',
    'toolbar.bold': 'Bold', 'toolbar.italic': 'Italic', 'toolbar.underline': 'Underline', 'toolbar.strike': 'Strikethrough',
    'toolbar.heading': 'Heading {level}', 'toolbar.blockquote': 'Quote', 'toolbar.bulletList': 'Bulleted list',
    'toolbar.orderedList': 'Numbered list', 'toolbar.sceneBreak': 'Scene break',
    'toolbar.alignLeft': 'Align left', 'toolbar.alignCenter': 'Center', 'toolbar.alignRight': 'Align right', 'toolbar.alignJustify': 'Justify',
    'toolbar.paragraphStyle': 'Paragraph style', 'toolbar.mixed': 'Mixed', 'toolbar.find': 'Find and replace',
  },
  uk: {
    'toolbar.label': 'Форматування', 'toolbar.undo': 'Скасувати', 'toolbar.redo': 'Повторити',
    'toolbar.bold': 'Жирний', 'toolbar.italic': 'Курсив', 'toolbar.underline': 'Підкреслений', 'toolbar.strike': 'Закреслений',
    'toolbar.heading': 'Заголовок {level}', 'toolbar.blockquote': 'Цитата', 'toolbar.bulletList': 'Маркований список',
    'toolbar.orderedList': 'Нумерований список', 'toolbar.sceneBreak': 'Розрив сцени',
    'toolbar.alignLeft': 'За лівим краєм', 'toolbar.alignCenter': 'По центру', 'toolbar.alignRight': 'За правим краєм', 'toolbar.alignJustify': 'За шириною',
    'toolbar.paragraphStyle': 'Стиль абзацу', 'toolbar.mixed': 'Різні', 'toolbar.find': 'Знайти й замінити',
  },
  fr: {
    'toolbar.label': 'Mise en forme', 'toolbar.undo': 'Annuler', 'toolbar.redo': 'Rétablir',
    'toolbar.bold': 'Gras', 'toolbar.italic': 'Italique', 'toolbar.underline': 'Souligné', 'toolbar.strike': 'Barré',
    'toolbar.heading': 'Titre {level}', 'toolbar.blockquote': 'Citation', 'toolbar.bulletList': 'Liste à puces',
    'toolbar.orderedList': 'Liste numérotée', 'toolbar.sceneBreak': 'Changement de scène',
    'toolbar.alignLeft': 'Aligner à gauche', 'toolbar.alignCenter': 'Centrer', 'toolbar.alignRight': 'Aligner à droite', 'toolbar.alignJustify': 'Justifier',
    'toolbar.paragraphStyle': 'Style de paragraphe', 'toolbar.mixed': 'Mixte', 'toolbar.find': 'Rechercher et remplacer',
  },
};
