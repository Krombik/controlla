export const EMPTY_ARR = [];

export const RELOAD = Symbol();

export const SILENT_RELOAD = Symbol();

export const enum ControlType {
  UNDEFINED,
  SYNC,
  ASYNC,
  LOADABLE,
}

export const enum PatchType {
  UNSET,
  SET,
  ERROR,
  RELOAD,
  SILENT_RELOAD,
}
