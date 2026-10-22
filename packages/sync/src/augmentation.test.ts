import { describe, it, expect } from 'vitest';
// Imported before anything else on purpose: TypeScript applied augmentations of a *re-exported*
// interface depending on file order, so an early import of a feature lost its FeatureRegistry entry.
import { collaboration } from './collaboration.js';
import { createEditor } from '@proseline-editor/core';

describe('FeatureRegistry augmentation', () => {
  it('types feature controllers regardless of import order (checked by tsc)', () => {
    const editor = createEditor();
    const state = editor.feature('collaboration')?.getState();
    const peers: { name: string }[] | undefined = state?.peers;
    expect(peers).toBeUndefined();
    expect(typeof collaboration).toBe('function');
    editor.destroy();
  });
});
