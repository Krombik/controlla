export const INTERNALS = Symbol();

export const EMPTY_ARR = [];

export const PASSIVE: AddEventListenerOptions = { passive: true };

export const RELOAD = Symbol();

export const SILENT_RELOAD = Symbol();

export const enum ControlType {
  UNDEFINED,
  SYNC,
  ASYNC,
  LOADABLE,
}

/** Order matters: commits branch on `< ERROR`. */
export const enum PatchType {
  UNSET,
  SET,
  ERROR,
  RELOAD,
  SILENT_RELOAD,
}
