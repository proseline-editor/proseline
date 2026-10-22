import type { JSONContent } from '@tiptap/core';

export interface VersionMeta {
  id: string;
  docId: string;
  /** Null for automatic snapshots. */
  label: string | null;
  auto: boolean;
  /** Word count when the snapshot was taken. */
  words: number;
  /** ISO 8601. */
  createdAt: string;
  authorName?: string;
}

export interface NewVersion {
  /** ProseMirror JSON of the whole document. */
  content: JSONContent;
  label: string | null;
  auto: boolean;
  words: number;
}

/** The host's persistence for snapshots. Proseline never stores versions itself. */
export interface VersionStore {
  /** Newest first. */
  list(docId: string): Promise<VersionMeta[]>;
  save(docId: string, version: NewVersion): Promise<VersionMeta>;
  load(versionId: string): Promise<JSONContent>;
  remove?(versionId: string): Promise<void>;
  subscribe?(docId: string, onChange: () => void): () => void;
}
