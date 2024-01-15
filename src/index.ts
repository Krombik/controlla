import { useEffect, useLayoutEffect, useState } from 'react';
import noop from 'lodash.noop';
import {
  Key,
  Options,
  SuperState,
  VersionedSuperState,
  _SuperState,
} from './types';

const SET_KEY = Symbol();

const enum RootKey {
  MAP,
  VALUE,
  ERROR,
  ERROR_SET,
  PROMISE,
  IS_LOADED,
  IS_LOADED_SET,
  IS_BUSY,
  IS_DUPLICATED,
  IS_RELOAD_ON_FOCUS_PAUSED,
  RELOAD_ON_FOCUS_LISTENER,
  RELOAD_ON_RECONNECT_LISTENER,
  DEDUPING_TIMEOUT_ID,
  SLOW_LOADING_TIMEOUT_ID,
  MOUNTS_COUNT,
  POLLING_STOP,
  POLLING_RESUME,
  POLLING_GET_PAUSE,
  POLLING_PROMISE,
  POLLING_RESOLVE,
}

type CallbackSet = Set<(value: any) => void>;

type NestedMap = Map<typeof SET_KEY, CallbackSet> & Map<Key, NestedMap>;

type Root = Map<RootKey.MAP, NestedMap> &
  Map<RootKey.VALUE, any> &
  Map<RootKey.ERROR, any> &
  Map<RootKey.ERROR_SET, CallbackSet> &
  Map<RootKey.PROMISE, Promise<any>> &
  Map<RootKey.DEDUPING_TIMEOUT_ID, number> &
  Map<RootKey.SLOW_LOADING_TIMEOUT_ID, number> &
  Map<RootKey.IS_BUSY, boolean> &
  Map<RootKey.IS_DUPLICATED, boolean> &
  Map<RootKey.IS_LOADED, boolean> &
  Map<RootKey.IS_RELOAD_ON_FOCUS_PAUSED, boolean> &
  Map<RootKey.RELOAD_ON_FOCUS_LISTENER, () => void> &
  Map<RootKey.RELOAD_ON_RECONNECT_LISTENER, () => void> &
  Map<RootKey.IS_LOADED_SET, CallbackSet> &
  Map<RootKey.MOUNTS_COUNT, number> &
  Map<RootKey.POLLING_STOP, () => void> &
  Map<RootKey.POLLING_RESUME, () => void> &
  Map<RootKey.POLLING_GET_PAUSE, () => Promise<void>> &
  Map<RootKey.POLLING_PROMISE, Promise<any>> &
  Map<RootKey.POLLING_RESOLVE, () => void>;

type StorageMap = Map<any, Root>;

const EMPTY_ARR: [] = [];

const safeGet = (value: any, path: Key[]) => {
  const l = path.length;

  for (let i = 0; i < l; i++) {
    const k = path[i];

    if (value && k in value) {
      value = value[k];
    } else {
      return;
    }
  }

  return value;
};

const createRoot = () => {
  const rootMap: NestedMap = new Map();

  rootMap.set(SET_KEY, new Set());

  const root: Root = new Map();

  root.set(RootKey.MAP, rootMap);

  root.set(RootKey.ERROR_SET, new Set());

  root.set(RootKey.IS_LOADED_SET, new Set());

  root.set(RootKey.IS_LOADED, false);

  root.set(RootKey.MOUNTS_COUNT, 0);

  return root;
};

const toKey = (value: any) => {
  if (value && Object.getPrototypeOf(value) == Object.prototype) {
    const keys = Object.keys(value).sort();

    let str = '';

    for (let i = keys.length; i--; ) {
      const key = keys[i];

      const child = value[key];

      if (child !== undefined) {
        str += `${key}\v${toKey(child)}\f`;
      }
    }

    return str;
  }

  return '' + value;
};

const handleVersionedStorage = () => {
  const storage: StorageMap = new Map();

  const keyStorage = new Map<string, any>();

  return (version: any) => {
    if (version == null) {
      throw new Error(`${version} is not allowed as version`);
    }

    if (storage.has(version)) {
      return storage.get(version)!;
    }

    if (version && typeof version == 'object') {
      const strKey = toKey(version);

      if (keyStorage.has(strKey)) {
        const prevKey = keyStorage.get(strKey)!;

        if (storage.has(prevKey)) {
          const root = storage.get(version)!;

          storage.delete(prevKey);

          storage.set(version, root);

          return root;
        }
      } else {
        keyStorage.set(strKey, version);
      }
    }

    const root = createRoot();

    storage.set(version, root);

    return root;
  };
};

const alwaysFalse = () => false as const;

const handleMandatoryCheck = (
  prevValue: any,
  nextValue: any,
  storage: NestedMap | undefined | false,
  setFn: () => true
): ((key: Key) => boolean) | false => {
  if (!storage || storage.size < 2) {
    return alwaysFalse;
  }

  let equalList: Set<Key> | false = new Set();

  forEachChild(storage, (key) => {
    const child = storage.get(key)!;

    const newValue = nextValue[key];

    if (handleNotEqual(prevValue[key], newValue, child, setFn)) {
      equalList = false;

      executeSetters(child.get(SET_KEY)!, newValue);
    } else if (equalList) {
      equalList.add(key);
    }
  });

  return equalList && equalList.has.bind(equalList);
};

const handleNil = (prevValue: any, nextValue: any, storage: NestedMap) => {
  executeSetters(storage.get(SET_KEY)!, nextValue);

  if (prevValue != nextValue && storage.size > 1) {
    forEachChild(
      storage,
      prevValue == null
        ? (key) => {
            const next = nextValue[key];

            if (next !== undefined) {
              handleNil(undefined, next, storage.get(key)!);
            }
          }
        : (key) => {
            const prev = prevValue[key];

            if (prev !== undefined) {
              handleNil(prev, undefined, storage.get(key)!);
            }
          }
    );
  }
};

const handleNotEqual = (
  prevValue: any,
  nextValue: any,
  storage: NestedMap | undefined | false,
  setFn: () => true
) => {
  if (prevValue === nextValue) {
    return false;
  }

  if (prevValue == null || nextValue == null) {
    setFn();

    if (storage) {
      handleNil(prevValue, nextValue, storage);
    }

    return true;
  }

  const aPrototype = Object.getPrototypeOf(prevValue);

  if (aPrototype != Object.getPrototypeOf(nextValue)) {
    setFn();

    if (storage) {
      executeSetters(storage.get(SET_KEY)!, nextValue);

      handleMandatoryCheck(prevValue, nextValue, storage, setFn);
    }

    return true;
  }

  if (aPrototype == Object.prototype) {
    const isChecked = handleMandatoryCheck(
      prevValue,
      nextValue,
      storage,
      setFn
    );

    if (!isChecked) {
      return true;
    }

    const aKeys = Object.keys(prevValue);

    let i = aKeys.length;

    if (i != Object.keys(nextValue).length) {
      return setFn();
    }

    const getStorage = storage
      ? (storage.get.bind(storage) as (typeof storage)['get'])
      : alwaysFalse;

    while (i--) {
      const key = aKeys[i];

      if (
        !isChecked(key) &&
        handleNotEqual(prevValue[key], nextValue[key], getStorage(key), setFn)
      ) {
        return true;
      }
    }

    return false;
  }

  if (Array.isArray(prevValue)) {
    const isChecked = handleMandatoryCheck(
      prevValue,
      nextValue,
      storage,
      setFn
    );

    if (!isChecked) {
      return true;
    }

    const l = prevValue.length;

    if (l != nextValue.length) {
      return setFn();
    }

    const getStorage = storage
      ? (storage.get.bind(storage) as (typeof storage)['get'])
      : alwaysFalse;

    for (let i = 0; i < l; i++) {
      if (
        !isChecked(i) &&
        handleNotEqual(prevValue[i], nextValue[i], getStorage(i), setFn)
      ) {
        return true;
      }
    }

    return false;
  }

  if (prevValue instanceof Date) {
    return prevValue.getTime() != nextValue.getTime() && setFn();
  }

  return setFn();
};

const getNewRootValue = (
  prevValue: any,
  nextValue: any,
  path: Key[],
  index: number,
  end: number,
  push: (value: any) => any
): any => {
  let newValue;

  if (index < end) {
    const k = path[index++] as Key;

    if (prevValue == null || typeof prevValue != 'object') {
      prevValue = typeof k == 'string' ? {} : [];
    }

    if (Array.isArray(prevValue)) {
      newValue = prevValue.slice();

      newValue[k as number] = getNewRootValue(
        prevValue[k as number],
        nextValue,
        path,
        index,
        end,
        push
      );
    } else {
      newValue = {
        ...prevValue,
        [k]: getNewRootValue(prevValue[k], nextValue, path, index, end, push),
      };
    }
  } else {
    newValue = nextValue;
  }

  push(newValue);

  return newValue;
};

const executeSetters = (set: CallbackSet, value: unknown) => {
  const it = set.values();

  const next = it.next.bind(it);

  for (let i = set.size; i--; ) {
    next().value(value);
  }
};

const forEachChild = (storage: NestedMap, fn: (key: Key) => void) => {
  const it = storage.keys();

  const next = it.next.bind(it);

  next(); // skip set

  for (let i = storage.size - 1; i--; ) {
    fn(next().value);
  }
};

const getMap = (root: Root, path: Key[]) => {
  const l = path.length;

  let parent = root.get(RootKey.MAP)!;

  for (let i = 0; i < l; i++) {
    const k: Key = path[i];

    if (!parent.has(k)) {
      for (; i < l; i++) {
        const child: NestedMap = new Map();

        child.set(SET_KEY, new Set());

        parent.set(path[i], child);

        parent = child;
      }

      return parent;
    }

    parent = parent.get(k)!;
  }

  return parent;
};

const deleteError = (root: Root) => {
  if (root.delete(RootKey.ERROR)) {
    executeSetters(root.get(RootKey.ERROR_SET)!, undefined);
  }
};

const deleteValue = (root: Root) => {
  if (root.has(RootKey.VALUE)) {
    safeSet(root, EMPTY_ARR, undefined);

    root.delete(RootKey.VALUE);
  }
};

const safeSet = (root: Root, path: Key[], nextValue: any) => {
  const l = path.length;

  const rootMap = root.get(RootKey.MAP)!;

  const nodesQueue: NestedMap[] = [rootMap];

  const valuesQueue: any[] = [];

  const rootValue = root.get(RootKey.VALUE);

  const prevValue = safeGet(rootValue, path);

  let currentNode: NestedMap | undefined = rootMap;

  let isNotUpdated = true;

  if (typeof nextValue == 'function') {
    nextValue = nextValue(prevValue);
  }

  for (let i = 0; i < l; i++) {
    const k = path[i] as Key;

    if (currentNode.has(k)) {
      nodesQueue.push((currentNode = currentNode.get(k)!));
    } else {
      currentNode = undefined;

      break;
    }
  }

  if (
    handleNotEqual(prevValue, nextValue, currentNode, (): true => {
      if (isNotUpdated) {
        root.set(
          RootKey.VALUE,
          getNewRootValue(
            rootValue,
            nextValue,
            path,
            0,
            l,
            valuesQueue.push.bind(valuesQueue)
          )
        );

        isNotUpdated = false;
      }

      return true;
    })
  ) {
    for (let i = nodesQueue.length; i--; ) {
      executeSetters(nodesQueue[i].get(SET_KEY)!, valuesQueue[i]);
    }
  }
};

const getPromise = (root: Root) => {
  if (root.has(RootKey.PROMISE)) {
    return root.get(RootKey.PROMISE)!;
  }

  const valueSet = root.get(RootKey.MAP)!.get(SET_KEY)!;

  const errorSet = root.get(RootKey.ERROR_SET)!;

  const promise = (
    root.has(RootKey.VALUE)
      ? Promise.resolve(root.get(RootKey.VALUE)!)
      : root.has(RootKey.ERROR)
        ? Promise.reject(root.get(RootKey.ERROR))
        : new Promise((res, rej) => {
            const resolve = (value: unknown) => {
              valueSet.delete(resolve);

              errorSet.delete(reject);

              res(value);
            };

            const reject = (error: unknown) => {
              valueSet.delete(resolve);

              errorSet.delete(reject);

              rej(error);
            };

            valueSet.add(resolve);

            errorSet.add(reject);
          })
  ).finally(() => {
    const cleanup = () => {
      valueSet.delete(cleanup);

      errorSet.delete(cleanup);

      root.delete(RootKey.PROMISE);
    };

    valueSet.add(cleanup);

    errorSet.add(cleanup);
  });

  root.set(RootKey.PROMISE, promise);

  return promise;
};

const addToSet = (set: CallbackSet, cb: (value: unknown) => void) => {
  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

const _set = (root: Root, path: Key[], value: any) => {
  deleteError(root);

  safeSet(root, path, value);
};

const _delete = (root: Root) => {
  deleteError(root);

  deleteValue(root);
};

const _setError = (root: Root, error: any) => {
  deleteValue(root);

  root.set(RootKey.ERROR, error);

  executeSetters(root.get(RootKey.ERROR_SET)!, error);
};

const GET_SET_KEY = Symbol();

const ROOT_KEY = Symbol();

const PATH_KEY = Symbol();

export class BaseState<T> {
  get: () => T;

  protected readonly [GET_SET_KEY]: (root: Root, path?: Key[]) => CallbackSet;
  protected readonly [ROOT_KEY]: Root;
  protected readonly [PATH_KEY]?: Key[];

  constructor(
    root: Root,
    get: (root: Root) => T,
    getSet: (root: Root) => CallbackSet
  );

  constructor(
    root: Root,
    get: (root: Root, path: Key[]) => T,
    getSet: (root: Root, path: Key[]) => CallbackSet,
    path: Key[]
  );

  constructor(
    root: Root,
    get: (...args: any[]) => T,
    getSet: (...args: any[]) => CallbackSet,
    path?: any
  ) {
    this.get = get.bind(null, root, path);

    this[GET_SET_KEY] = getSet;

    this[ROOT_KEY] = root;

    this[PATH_KEY] = path;
  }

  use<D extends boolean = false>(disabled?: D): D extends true ? undefined : T;
  use(disabled?: boolean) {
    if (!disabled) {
      const root = this[ROOT_KEY];
      const path = this[PATH_KEY];

      const forceRerender = useState<{}>()[1];

      useLayoutEffect(
        () =>
          addToSet(this[GET_SET_KEY](root, path), () => {
            forceRerender({});
          }),
        [root, path && path.join('.')]
      );

      return this.get();
    }

    useNoop();
  }

  onChange(cb: (value: T) => void) {
    return addToSet(this[GET_SET_KEY](this[ROOT_KEY], this[PATH_KEY]), cb);
  }
}

export class State<T> extends BaseState<T> {
  set(value: T | ((prevValue: T) => T)) {
    _set(this[ROOT_KEY], this[PATH_KEY]!, value);
  }
}

export class ErrorState<T> extends BaseState<T | undefined> {
  set(error: T) {
    _setError(this[ROOT_KEY], error);
  }
}

export class AsyncState<T> extends State<T> {
  suspense<D extends boolean = false>(
    disabled?: D
  ): D extends true ? undefined : T;
  suspense(disabled?: boolean) {
    if (disabled) {
      return useNoop();
    }

    const root = this[ROOT_KEY];

    if (root.has(RootKey.VALUE)) {
      const path = this[PATH_KEY]!;

      const t = useState<{}>();

      useLayoutEffect(() => {
        const setValue = t[1];

        const forceRerender = () => {
          setValue({});
        };

        const unlistenValue = addToSet(
          this[GET_SET_KEY](root, path),
          forceRerender
        );

        const unlistenError = addToSet(
          root.get(RootKey.ERROR_SET)!,
          forceRerender
        );

        return () => {
          unlistenValue();

          unlistenError();
        };
      }, [root, path.join('.')]);

      return this.get();
    }

    throw root.has(RootKey.ERROR) ? root.get(RootKey.ERROR) : getPromise(root);
  }
}

const FETCH_METHOD_KEY = Symbol();

const FETCH_KEY = Symbol();

const FETCH_ARG_KEY = Symbol();

class LoadableState<T> extends AsyncState<T> {
  private readonly [FETCH_KEY]: ReturnType<typeof createRegisterableLoader>;

  private readonly [FETCH_ARG_KEY]: any;

  constructor(
    root: Root,
    get: (root: Root, path: Key[]) => T,
    getSet: (root: Root, path: Key[]) => CallbackSet,
    path: Key[],
    fetch: ReturnType<typeof createRegisterableLoader>,
    fetchArg?: any
  ) {
    super(root, get, getSet, path);

    this[FETCH_KEY] = fetch;

    this[FETCH_ARG_KEY] = fetchArg;
  }

  private [FETCH_METHOD_KEY](disabled?: boolean) {
    if (disabled) {
      useEffect(noop, [0]);
    } else {
      const root = this[ROOT_KEY];

      useEffect(this[FETCH_KEY](root, this[FETCH_ARG_KEY]), [root]);
    }
  }

  useWithLoad<D extends boolean = false>(disabled?: D) {
    this[FETCH_METHOD_KEY](disabled);

    return this.use(disabled);
  }

  suspenseWithLoad<D extends boolean = false>(disabled?: D) {
    this[FETCH_METHOD_KEY](disabled);

    return this.suspense(disabled);
  }
}

const createLoader = (
  slowLoadingSet: CallbackSet,
  options: Options<any, any>
) => {
  const { fetcher, dedupingInterval, loadingTimeout } = options;

  return (root: Root, arg?: any, onLoad?: () => void) => {
    if (!root.get(RootKey.IS_BUSY)) {
      beforeLoad(root, dedupingInterval);

      executeFetcher(fetcher, arg, root, slowLoadingSet, loadingTimeout).then(
        () => {
          (onLoad || noop)();

          afterLoad(root, dedupingInterval);

          root.set(RootKey.IS_BUSY, false);
        }
      );
    }
  };
};

const becomingOnline: {
  (): Promise<void>;
  _?: Promise<void>;
} = () =>
  navigator.onLine
    ? Promise.resolve()
    : becomingOnline._ ||
      (becomingOnline._ = new Promise<void>((res) => {
        window.addEventListener(
          'online',
          () => {
            becomingOnline._ = undefined;

            res();
          },
          { once: true }
        );
      }));

const handlePause = (root: Root) => {
  let pausePromise: Promise<void> | undefined;

  let resume: () => void;

  root.set(RootKey.POLLING_STOP, () => {
    if (!pausePromise) {
      pausePromise = new Promise((res) => {
        resume = res;
      });
    }
  });

  root.set(RootKey.POLLING_RESUME, () => {
    if (pausePromise) {
      pausePromise = undefined;

      resume();
    }
  });

  root.set(RootKey.POLLING_GET_PAUSE, () =>
    pausePromise ? pausePromise : Promise.resolve()
  );
};

const executeFetcher = async (
  fetcher: (arg?: any) => Promise<any>,
  arg: any,
  root: Root,
  slowLoadingSet: CallbackSet,
  loadingTimeout: number | undefined
) => {
  if (loadingTimeout) {
    root.set(
      RootKey.SLOW_LOADING_TIMEOUT_ID,
      window.setTimeout(() => {
        executeSetters(slowLoadingSet, arg);
      }, loadingTimeout)
    );
  }

  await fetcher(arg)
    .then(_set.bind(null, root, EMPTY_ARR))
    .catch(_setError.bind(null, root));

  if (loadingTimeout) {
    window.clearTimeout(root.get(RootKey.SLOW_LOADING_TIMEOUT_ID));
  }
};

const beforeLoad = (root: Root, dedupingInterval: number | undefined) => {
  if (dedupingInterval) {
    window.clearTimeout(root.get(RootKey.DEDUPING_TIMEOUT_ID));
  }

  root.set(RootKey.IS_BUSY, true);

  root.set(RootKey.IS_DUPLICATED, true);

  root.set(RootKey.IS_LOADED, false);

  executeSetters(root.get(RootKey.IS_LOADED_SET)!, false);
};

const afterLoad = (root: Root, dedupingInterval: number | undefined) => {
  root.set(RootKey.IS_LOADED, true);

  executeSetters(root.get(RootKey.IS_LOADED_SET)!, true);

  if (dedupingInterval) {
    root.set(
      RootKey.DEDUPING_TIMEOUT_ID,
      window.setTimeout(() => {
        root.set(RootKey.IS_DUPLICATED, false);
      }, dedupingInterval)
    );
  }
};

const startPolling = async (
  fetcher: (arg?: any) => Promise<any>,
  arg: any,
  root: Root,
  slowLoadingSet: CallbackSet,
  loadingTimeout: number | undefined,
  getPause: () => Promise<void>,
  sleep: (root: Root) => Promise<void>
) => {
  while (root.get(RootKey.IS_BUSY)) {
    await becomingOnline();

    await getPause();

    if (root.get(RootKey.IS_BUSY)) {
      await executeFetcher(fetcher, arg, root, slowLoadingSet, loadingTimeout);
    } else {
      break;
    }

    if (!root.get(RootKey.IS_BUSY)) {
      break;
    }

    await sleep(root);
  }
};

const handleGetInterval = (interval: number | ((value: any) => number)) =>
  typeof interval == 'number'
    ? () => interval
    : (root: Root) => interval(root.get(RootKey.VALUE));

const createPoller = (
  slowLoadingSet: CallbackSet,
  options: Options<any, any>
) => {
  const {
    fetcher,
    dedupingInterval,
    loadingTimeout,
    pollingInterval,
    pollingWhenHidden,
  } = options;

  const getVisibleInterval = handleGetInterval(pollingInterval);

  const getHiddenInterval =
    pollingWhenHidden == null
      ? getVisibleInterval
      : handleGetInterval(pollingWhenHidden);

  const getInterval = (root: Root) =>
    (document.hidden ? getHiddenInterval : getVisibleInterval)(root);

  const sleep = (root: Root) =>
    new Promise<void>((res) => {
      const listener = () => {
        window.clearTimeout(timeoutId);

        const delay = getInterval(root);

        if (delay > 0) {
          const now = performance.now();

          const diff = now - start - delay;

          start = now;

          if (diff > 0) {
            timeoutId = window.setTimeout(resolve, diff);
          } else {
            resolve();
          }
        } else {
          timeoutId = undefined;
        }
      };

      const resolve = () => {
        document.removeEventListener('visibilitychange', listener);

        timeoutId = undefined;

        res();
      };

      const delay = getInterval(root);

      let timeoutId: number | undefined;

      let start = performance.now();

      document.addEventListener('visibilitychange', listener);

      if (delay > 0) {
        timeoutId = window.setTimeout(resolve, delay);
      }
    });

  return (root: Root, arg?: any, onLoad?: () => void) => {
    if (!root.get(RootKey.IS_BUSY)) {
      beforeLoad(root, dedupingInterval);

      root.set(RootKey.POLLING_RESOLVE, () => {
        root.set(RootKey.IS_BUSY, false);

        root.set(RootKey.POLLING_RESOLVE, noop);

        if (root.get(RootKey.MOUNTS_COUNT)) {
          (onLoad || noop)();

          afterLoad(root, dedupingInterval);
        } else {
          root.set(RootKey.IS_DUPLICATED, false);
        }
      });

      startPolling(
        fetcher,
        arg,
        root,
        slowLoadingSet,
        loadingTimeout,
        root.get(RootKey.POLLING_GET_PAUSE)!,
        sleep
      );
    }
  };
};

const createRegisterableLoader = (
  load: (root: Root, arg: any, onLoad?: () => void) => void,
  options: Options<any, any>,
  onUnregister?: (root: Root) => void
) => {
  const { reloadOnFocus, reloadOnReconnect } = options;

  onUnregister ||= noop;

  return (root: Root, arg: any) => {
    if (!root.get(RootKey.IS_DUPLICATED)) {
      load(root, arg);
    }

    return () => {
      if (reloadOnFocus && !root.has(RootKey.RELOAD_ON_FOCUS_LISTENER)) {
        const listener = () => {
          if (!root.get(RootKey.IS_RELOAD_ON_FOCUS_PAUSED)) {
            root.set(RootKey.IS_RELOAD_ON_FOCUS_PAUSED, true);

            load(root, arg, () => {
              window.setTimeout(() => {
                root.set(RootKey.IS_RELOAD_ON_FOCUS_PAUSED, false);
              }, reloadOnFocus);
            });
          }
        };

        root.set(RootKey.RELOAD_ON_FOCUS_LISTENER, listener);

        document.addEventListener('visibilitychange', listener);
      }

      if (
        reloadOnReconnect &&
        !root.has(RootKey.RELOAD_ON_RECONNECT_LISTENER)
      ) {
        const listener = () => {
          load(root, arg);
        };

        root.set(RootKey.RELOAD_ON_RECONNECT_LISTENER, listener);

        window.addEventListener('online', listener);
      }

      root.set(RootKey.MOUNTS_COUNT, root.get(RootKey.MOUNTS_COUNT)! + 1);

      return () => {
        const activeCount = root.get(RootKey.MOUNTS_COUNT)! - 1;

        root.set(RootKey.MOUNTS_COUNT, activeCount);

        if (!activeCount) {
          if (reloadOnFocus) {
            document.removeEventListener(
              'visibilitychange',
              root.get(RootKey.RELOAD_ON_FOCUS_LISTENER)!
            );

            root.delete(RootKey.RELOAD_ON_FOCUS_LISTENER);
          }

          if (reloadOnReconnect) {
            window.removeEventListener(
              'online',
              root.get(RootKey.RELOAD_ON_RECONNECT_LISTENER)!
            );

            root.delete(RootKey.RELOAD_ON_RECONNECT_LISTENER);
          }

          onUnregister!(root);
        }
      };
    };
  };
};

const useNoop = () => {
  useState();

  useLayoutEffect(noop, [0, 0]);
};

const getNestedValue = (root: Root, path: Key[]) =>
  safeGet(root.get(RootKey.VALUE), path);

const getNestedSet = (root: Root, path: Key[]) =>
  getMap(root, path).get(SET_KEY)!;

const getError = (root: Root) => root.get(RootKey.ERROR)!;

const getErrorSet = (root: Root) => root.get(RootKey.ERROR_SET)!;

const getIsLoaded = (root: Root) => root.get(RootKey.IS_LOADED)!;

const getIsLoadedSet = (root: Root) => root.get(RootKey.IS_LOADED_SET)!;

export const createVersionedState = <V, T, E = any>(options: Options<V, T>) => {
  const getRoot = handleVersionedStorage();

  const loadingSlowSet: CallbackSet = new Set();

  const fn = ((version: V, ...path: Key[]) =>
    version != null
      ? new LoadableState(
          getRoot(version),
          getNestedValue,
          getNestedSet,
          path,
          kek,
          version
        )
      : { use: useNoop, suspense: useNoop }) as VersionedSuperState<V, T, E>;

  fn.clear = (version) => {
    _delete(getRoot(version));
  };

  fn.error = (version) => {
    if (version != null) {
      return new ErrorState(getRoot(version), getError, getErrorSet);
    }

    return { use: useNoop, suspense: useNoop } as any;
  };

  fn.getPromise = (version) => getPromise(getRoot(version));

  const load = createLoader(loadingSlowSet, options);

  const kek = createRegisterableLoader(load, options, (root) => {
    root.get(RootKey.POLLING_RESOLVE)!();
  });

  fn.fetch = (version) => {
    const root = getRoot(version);

    if (!root.get(RootKey.IS_DUPLICATED)) {
      load(root, version);
    }

    return fn;
  };

  fn.refetch = (version) => {
    load(getRoot(version), version);

    return fn;
  };

  fn.onLoadingSlow = addToSet.bind(null, loadingSlowSet);

  fn.isLoaded = (version) => {
    if (version != null) {
      return new BaseState(getRoot(version), getIsLoaded, getIsLoadedSet);
    }

    return { use: useNoop } as any;
  };

  return fn;
};

export const createSuperState = <T, E = any>() => {
  const root = createRoot();

  const fn = ((...path: Key[]) =>
    new AsyncState(root, getNestedValue, getNestedSet, path)) as SuperState<
    T,
    E
  >;

  fn.clear = _delete.bind(null, root);

  fn.error = new ErrorState(root, getError, getErrorSet);

  fn.getPromise = getPromise.bind(null, root);

  return fn;
};
