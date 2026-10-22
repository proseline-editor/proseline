import * as Y from 'yjs';

/** True when `update` is a well-formed Yjs update (it applies cleanly to an empty document). */
export const isValidUpdate = (update: Uint8Array): boolean => {
  try {
    Y.applyUpdate(new Y.Doc(), update);
    return true;
  } catch {
    return false;
  }
};

export const isValidStateVector = (stateVector: Uint8Array): boolean => {
  try {
    Y.decodeStateVector(stateVector);
    return true;
  } catch {
    return false;
  }
};

export const mergeUpdates = (updates: Uint8Array[]): Uint8Array => Y.mergeUpdates(updates);

/** The part of `state` a peer with `stateVector` lacks (everything when it is absent). */
export const diffForStateVector = (state: Uint8Array, stateVector?: Uint8Array): Uint8Array =>
  stateVector ? Y.diffUpdate(state, stateVector) : state;

export const stateVectorOf = (state: Uint8Array): Uint8Array => Y.encodeStateVectorFromUpdate(state);

/** Fold an append-only update log into one snapshot once it has more than `threshold` rows. */
export const shouldCompact = (rows: number, threshold = 200): boolean => rows > threshold;
