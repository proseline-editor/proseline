import * as Y from 'yjs';
import { getSchema, type AnyExtension, type JSONContent } from '@tiptap/core';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import { prosemirrorJSONToYDoc, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap';
import { countTextWords, proseExtensions } from '@proseline-editor/core';
import { DEFAULT_FIELD } from '../collaboration.js';

export interface DeriveOptions {
  /** Yjs fragment name. Default `prosemirror`. */
  field?: string;
  /** Schema extensions; must match the editor's. Default: Proseline's prose schema. */
  extensions?: AnyExtension[];
}

let defaultExtensions: AnyExtension[] | null = null;
const schemas = new WeakMap<AnyExtension[], Schema>();

const extensionsOf = (opts: DeriveOptions): AnyExtension[] => opts.extensions ?? (defaultExtensions ??= proseExtensions());
const schemaOf = (extensions: AnyExtension[]): Schema => {
  let schema = schemas.get(extensions);
  if (!schema) {
    schema = getSchema(extensions);
    schemas.set(extensions, schema);
  }
  return schema;
};

const rootNode = (state: Uint8Array | Y.Doc, opts: DeriveOptions): PMNode => {
  let doc: Y.Doc;
  if (state instanceof Y.Doc) {
    doc = state;
  } else {
    doc = new Y.Doc();
    Y.applyUpdate(doc, state);
  }
  return yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(opts.field ?? DEFAULT_FIELD), schemaOf(extensionsOf(opts)));
};

/** ProseMirror JSON of a Yjs document (state or live Y.Doc). */
export const deriveJSON = (state: Uint8Array | Y.Doc, opts: DeriveOptions = {}): JSONContent => rootNode(state, opts).toJSON() as JSONContent;

/** HTML of a Yjs document — e.g. the derived copy a server stores for search, previews or export. */
export const deriveHtml = (state: Uint8Array | Y.Doc, opts: DeriveOptions = {}): string =>
  generateHTML(deriveJSON(state, opts), extensionsOf(opts));

/** Plain text, paragraphs separated by blank lines. */
export const deriveText = (state: Uint8Array | Y.Doc, opts: DeriveOptions = {}): string => {
  const node = rootNode(state, opts);
  return node.textBetween(0, node.content.size, '\n\n', ' ');
};

/** Word count using the editor's rules (tokens containing a letter or digit). */
export const countWords = (state: Uint8Array | Y.Doc, opts: DeriveOptions = {}): number => {
  const node = rootNode(state, opts);
  return countTextWords(node.textBetween(0, node.content.size, ' ', ' '));
};

/** Seeds a Yjs document from HTML (e.g. migrating stored content); returns its encoded state. */
export const htmlToUpdate = (html: string, opts: DeriveOptions = {}): Uint8Array => {
  const extensions = extensionsOf(opts);
  const json = generateJSON(html.trim() ? html : '<p></p>', extensions);
  return Y.encodeStateAsUpdate(prosemirrorJSONToYDoc(schemaOf(extensions), json, opts.field ?? DEFAULT_FIELD));
};
