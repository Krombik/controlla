import type { Registry } from '#types';
import type {
  AsyncControlInternals,
  ControlInternals,
  Subscription,
} from '#internal/types';
import { ControlType, INTERNALS } from '#internal/constants';
import { cleanupScope } from '#internal/cleanup';

/**
 * The storage subscription of every item that has one, so a `delete` or a
 * `clear` stops observing what it drops. An item with no external storage, or
 * one whose storage does not observe, is not in here.
 */
const observedItems = new WeakMap<any, Subscription>();

/**
 * Makes the item for {@link keys} and puts it in {@link storage}. Outside any
 * scope of whoever asked for it: the item outlives them, whether that is a
 * `get` or a bound control resolving its target, so the registry keeps its
 * subscriptions itself and subscribes them right away.
 */
export const createItem = (
  registry: Registry<any, any>,
  storage: Map<any, any>,
  storageKey: any,
  keys: any[] | undefined
) => {
  const self = registry as any;

  const externalStorage = self._externalStorage;

  const prevScope = cleanupScope._value;

  const scope: Subscription[] | null = externalStorage
    ? (cleanupScope._value = [])
    : null;

  let control: any;

  try {
    storage.set(
      storageKey,
      (control = self._createControl(self._initArg, externalStorage, keys))
    );
  } finally {
    cleanupScope._value = prevScope;
  }

  // only the external storage subscribes, so there is at most the one
  if (scope && scope.length != 0) {
    const subscription = scope[0];

    self._isObserved = true;

    observedItems.set(control, subscription);

    subscription._subscribe();
  }

  if (self._type == ControlType.UNDEFINED) {
    self._type = getControlType(control[INTERNALS]);
  }

  return control;
};

/**
 * {@link levels} of storages above the controls, 0 for a control itself -
 * nothing observes an external storage once its control is gone.
 */
export const cleanupItems = (item: any, levels: number) => {
  if (levels) {
    const it = item.values();

    for (let i = item.size; i--;) {
      cleanupItems(it.next().value, levels - 1);
    }
  } else {
    const subscription = observedItems.get(item);

    // a storage that never observed is nothing to stop observing
    if (subscription) {
      subscription._cleanup();
    }
  }
};

export const getControlType = (
  internals: ControlInternals | AsyncControlInternals
) =>
  internals._load
    ? ControlType.LOADABLE
    : '_errorControl' in internals
      ? ControlType.ASYNC
      : ControlType.SYNC;

export const getRegistryDepth = (registry: Registry<any, any>, keys: any[]) => {
  const depth = keys.length;

  const registryDepth = registry._depth;

  if (registryDepth != depth) {
    if (registryDepth) {
      throw new Error('inconsistent keys count');
    }

    (registry as any)._depth = depth;
  }

  return depth;
};
