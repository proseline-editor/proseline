type Handler<P> = (payload: P) => void;

export interface Emitter<M extends object> {
  on<E extends keyof M>(event: E, handler: Handler<M[E]>): () => void;
  emit<E extends keyof M>(event: E, payload: M[E]): void;
  clear(): void;
}

/** Tiny typed event emitter. A throwing handler does not stop the others. */
export const createEmitter = <M extends object>(onHandlerError?: (error: unknown) => void): Emitter<M> => {
  const handlers = new Map<keyof M, Set<Handler<never>>>();
  return {
    on: (event, handler) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler as Handler<never>);
      handlers.set(event, set);
      return () => {
        set.delete(handler as Handler<never>);
      };
    },
    emit: (event, payload) => {
      handlers.get(event)?.forEach((handler) => {
        try {
          (handler as Handler<typeof payload>)(payload);
        } catch (error) {
          onHandlerError?.(error);
        }
      });
    },
    clear: () => handlers.clear(),
  };
};
