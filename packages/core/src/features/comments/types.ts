import type { EditorState, Transaction } from '@tiptap/pm/state';

/**
 * Where a thread points. Opaque to hosts: store it as JSON. `quote` (the commented text when the
 * thread was created) lets the editor find the place again if the anchor stops resolving.
 */
export interface CommentAnchor {
  type: string;
  quote: string;
  [key: string]: unknown;
}

export interface Comment {
  id: string;
  authorId: string;
  /** Display name, if the store knows it. */
  authorName?: string;
  body: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface CommentThread {
  id: string;
  docId: string;
  anchor: CommentAnchor;
  resolved: boolean;
  createdAt: string;
  /** The first comment opens the thread; the rest are replies, oldest first. */
  comments: Comment[];
}

export interface NewThread {
  docId: string;
  anchor: CommentAnchor;
  body: string;
}

/** The host's persistence for comments. Proseline never stores comments itself. */
export interface CommentStore {
  list(docId: string): Promise<CommentThread[]>;
  create(input: NewThread): Promise<CommentThread>;
  reply(threadId: string, body: string): Promise<CommentThread>;
  setResolved(threadId: string, resolved: boolean): Promise<void>;
  remove(threadId: string): Promise<void>;
  /** Persist a moved anchor (re-anchored by quote, or shifted positions in single-user mode). */
  updateAnchor?(threadId: string, anchor: CommentAnchor): Promise<void>;
  /** Call `onChange` when someone else changed the document's comments. Returns an unsubscribe. */
  subscribe?(docId: string, onChange: () => void): () => void;
}

export interface Range {
  from: number;
  to: number;
}

/** How anchors are made and found. Core ships position anchoring; @proseline-editor/sync ships Yjs anchoring. */
export interface AnchorStrategy {
  create(state: EditorState, range: Range): CommentAnchor;
  /** The anchor's current range, or null when it no longer resolves (the quote is searched for next). */
  resolve(state: EditorState, anchor: CommentAnchor): Range | null;
  /**
   * True when ranges should be resolved afresh after `tr` (e.g. it carries remote Yjs changes).
   * Otherwise known ranges are mapped through the transaction.
   */
  isAuthoritative?(tr: Transaction): boolean;
  /** True when shifted ranges should be persisted (position anchors go stale as text moves). */
  persistsPositions?: boolean;
}
