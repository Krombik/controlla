import noop from '#internal/noop';

import type { Lane, Mutable, PendingItem } from '#internal/types';
import type { RouterPatch, RouterHandler } from '#router/internal/types';
import queueRouterPatch from '#router/internal/queueRouterPatch';

export const paramsHandler: RouterHandler = {
  _level: 0,
  _lanes: [],
  _hasNavigation: false,
  _commitSet: noop,
};

export const getRouterPatch = (lane: Lane) => {
  let patch = lane._patchByControl.get(paramsHandler) as
    RouterPatch | undefined;

  if (!patch) {
    queueRouterPatch(
      lane,
      (patch = {
        _navigation: undefined,
        _updates: [],
        _replace: true,
        ...(__NATIVE__
          ? ({} as Pick<RouterPatch, '_hashChanged'>)
          : { _hashChanged: false }),
      })
    );

    paramsHandler._lanes.push(lane);
  }

  return patch;
};

export const clearWrites = () => {
  const lanes = paramsHandler._lanes;

  for (let i = 0; i < lanes.length; i++) {
    lanes[i]._patchByControl.delete(paramsHandler);
  }

  lanes.length = 0;
};

export const urlFinalizer: Mutable<PendingItem> = {
  _level: 0,
  _commitSet: noop,
};

/**
 * True only while `replaceValue`'s enqueue runs; the router turns such
 * writes into history replaces.
 */
export const replacing = { _value: false };

/**
 * What `repairHistory` and `go` share with the router. `_entries` and `_pop`
 * are native only - the router fills them there, and the web build carries
 * neither.
 */
type HistoryState = {
  _knownLength: number;
  _index: number;
  _repairedUrl: string;
  _resolveRepair: (() => void) | undefined;
  //#region react-native ONLY
  /**
   * There is no address bar to read, so the stack of urls *is* the history,
   * and `_index` is where in it we are.
   */
  _entries: string[];
  /** Moving to another entry, which is the router's `popstate` path. */
  _pop(index: number): void;
  //#endregion
};

export const historyState = {
  _knownLength: 0,
  _index: 0,
  _repairedUrl: '',
  _resolveRepair: undefined,
  ...(__NATIVE__ ? { _entries: [], _pop: noop } : {}),
} as HistoryState;

/** What `navigationBlocker` shares with the router. */
export const blocker = {
  _canNavigate: true,
  _resume: noop as () => void,
};
