export const EMPTY_ARR: [] = [];

export const RESOLVED_PROMISE = Promise.resolve();

export const enum RootKey {
  VALUE,
  PROMISE,
  PROMISE_RESOLVE,
  PROMISE_REJECT,
  SLOW_LOADING_TIMEOUT_ID,
  UNLOAD,
  STABLE_VALUE,
}
