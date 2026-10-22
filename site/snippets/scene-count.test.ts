import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '@proseline-editor/core';
import { sceneCount } from './scene-count';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

describe('the guide\'s sceneCount feature', () => {
  it('counts scenes, inserts breaks and translates its label', () => {
    editor = createEditor({ content: '<p>One</p><hr><p>Two</p>', locale: 'uk', features: [sceneCount()] });
    const scenes = editor.feature('sceneCount')!;
    expect(scenes.getState().scenes).toBe(2);
    editor.tiptap.commands.focus('end');
    expect(scenes.commands.insertBreak()).toBe(true);
    expect(scenes.getState().scenes).toBe(3);
    expect(editor.t('sceneCount.label', { count: 3 })).toBe('Сцен: 3');
  });
});
