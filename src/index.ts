import { useEffect, useLayoutEffect, useState } from 'react';
import noop from 'lodash.noop';
import {
  AsyncRoot,
  CallbackSet,
  Key,
  LoadableRoot,
  NestedMap,
  Options,
  Root,
  RootKey,
  VersionedNestedState,
  State,
  AsyncState,
  NestedState,
  NestedAsyncState,
  SetKey,
  ValueKey,
  _SimplifiedState,
  PollableRoot,
  Falsy,
  PollableState,
  AnyState,
  AnyAsyncState,
  Listener,
  AnyPollableState,
} from './types';
import identity from 'lodash.identity';

type StorageMap = Map<any, Root>;

const EMPTY_ARR: [] = [];

const safeGet = (value: any, path: Key[]) => {
  const l = path.length;

  for (
    let i = 0;
    i < l && (value = value ? value[path[i]] : undefined) !== undefined;
    i++
  ) {}

  return value;
};

const createRoot = () => {
  const root: Root = new Map();

  const rootMap: NestedMap = new Map();

  rootMap.set(EMPTY_ARR, new Set());

  root.set(RootKey.VALUE_GET_CALLBACK_SET, (path) => {
    const l = path.length;

    let parent = rootMap;

    for (let i = 0; i < l; i++) {
      const k = path[i];

      if (!parent.has(k)) {
        let set: CallbackSet;

        for (; i < l; i++) {
          const child: NestedMap = new Map();

          child.set(EMPTY_ARR, (set = new Set()));

          parent.set(path[i], child);

          parent = child;
        }

        return set!;
      }

      parent = parent.get(k)!;
    }

    return parent.get(EMPTY_ARR)!;
  });

  root.set(RootKey.VALUE_GET, safeGet);

  root.set(RootKey.VALUE_SET, (nextValue, rootValue, isSet, path) => {
    const l = path.length;

    const nodesQueue: NestedMap[] = [rootMap];

    let currentNode: NestedMap | false = rootMap;

    for (let i = 0; i < l; i++) {
      const k = path[i];

      if (currentNode.has(k)) {
        currentNode = currentNode.get(k)!;

        nodesQueue.push(currentNode);
      } else {
        currentNode = false;

        break;
      }
    }

    if (handleNotEqual(safeGet(rootValue, path), nextValue, currentNode)) {
      const valuesQueue: any[] = [];

      if (isSet) {
        if (l) {
          const lastIndex = l - 1;

          let newValue =
            rootValue && typeof rootValue == 'object'
              ? Array.isArray(rootValue)
                ? rootValue.slice()
                : { ...rootValue }
              : typeof path[0] == 'string'
                ? {}
                : [];

          root.set(RootKey.VALUE, newValue);

          valuesQueue.push(newValue);

          for (let i = 0; i < lastIndex; i++) {
            const key = path[i];

            const original = newValue[key];

            const copy =
              original && typeof original == 'object'
                ? Array.isArray(original)
                  ? original.slice()
                  : { ...original }
                : typeof key == 'string'
                  ? {}
                  : [];

            newValue[key] = copy;

            newValue = copy;

            valuesQueue.push(copy);
          }

          newValue[path[lastIndex]] = nextValue;
        } else {
          root.set(RootKey.VALUE, nextValue);
        }

        valuesQueue.push(nextValue);
      }

      for (let i = nodesQueue.length; i--; ) {
        executeSetters(nodesQueue[i].get(EMPTY_ARR)!, valuesQueue[i]);
      }
    }
  });

  return root;
};

const createPrimitiveRoot = () => {
  const root: Root = new Map();

  const valueSet: CallbackSet = new Set();

  root.set(RootKey.VALUE_GET_CALLBACK_SET, () => valueSet);

  root.set(RootKey.VALUE_GET, identity);

  root.set(RootKey.VALUE_SET, (value, prevValue, isSet) => {
    if (prevValue !== value) {
      if (isSet) {
        root.set(RootKey.VALUE, value);
      }

      executeSetters(valueSet, value);
    }
  });

  return root;
};

const createPrimitiveSetter =
  (valueKey: ValueKey, setKey: SetKey) =>
  (state: _SimplifiedState, value: any) => {
    const root = state.r;

    if (root.get(valueKey)! !== value) {
      root.set(valueKey, value);

      executeSetters(root.get(setKey), value);
    }

    return state;
  };

const injectAsync = (prev: Root, listeners?: Listener[]) => {
  const root = prev as AsyncRoot;

  root.set(RootKey.ERROR_CALLBACK_SET, new Set());

  root.set(RootKey.IS_LOADED_CALLBACK_SET, new Set());

  root.set(RootKey.IS_LOADED, false);

  if (listeners && listeners.length) {
    let unlisteners: (() => void)[];

    let count = 0;

    root.set(RootKey.HANDLE_LISTENERS, (state) => {
      if (!count++) {
        unlisteners = [];

        for (let i = 0; i < listeners.length; i++) {
          const unlisten = listeners[i](state);

          if (unlisten) {
            unlisteners.push(unlisten);
          }
        }
      }

      return () => {
        if (!--count) {
          for (let i = 0; i < unlisteners.length; i++) {
            unlisteners[i]();
          }
        }
      };
    });
  }

  return root;
};

const injectLoadable = (
  prev: Root,
  fetcher: (arg: any) => Promise<any>,
  loadingTimeout?: number
) => {
  const root = injectAsync(prev) as LoadableRoot;

  let isFree = true;

  let cancel: () => void = noop;

  const slowLoadingSet = (loadingTimeout && new Set()) as CallbackSet;

  const _setValue = root.get(RootKey.VALUE_SET)!;

  root.set(RootKey.VALUE_SET, (nextValue, rootValue, isSet, path, isError) => {
    const isLoaded = isSet || isError;

    _setValue(nextValue, rootValue, isSet, path, isError);

    setLoad({ r: root }, isLoaded);

    if (isLoaded) {
      cancel();
    }
  });

  root.set(RootKey.IS_LOAD_AVAILABLE, true);

  root.set(RootKey.LOAD, async (arg) => {
    if (isFree) {
      isFree = false;

      let isRunning = true;

      const cancelPromise = new Promise<void>((res) => {
        cancel = () => {
          isFree = true;

          isRunning = false;

          cancel = noop;

          res();
        };
      });

      setLoad({ r: root }, isFree);

      root.set(RootKey.IS_LOAD_AVAILABLE, false);

      await Promise.any([becomingOnline(), cancelPromise]);

      if (isRunning) {
        const promise = Promise.any([
          fetcher(arg)
            .then((value) => {
              if (isRunning) {
                setValue({ r: root, p: EMPTY_ARR }, value);
              }
            })
            .catch((err) => {
              if (isRunning) {
                setError({ r: root }, err);
              }
            }),
          cancelPromise,
        ]);

        loadingTimeout
          ? withSlowLoading(promise, loadingTimeout, slowLoadingSet)
          : promise;
      }
    }
  });
};

const infectPollable = (
  prev: Root,
  fetcher: (arg: any) => Promise<any>,
  until: (value: any) => boolean,
  interval: number | ((value: any) => number),
  hiddenInterval?: number | ((value: any) => number),
  loadingTimeout?: number
) => {
  let sleep: (getInterval: () => number) => Promise<void>;

  let getInterval: () => number;

  let pausePromise: Promise<void> | undefined | false;

  let cancel: () => void = noop;

  let isPolling = false;

  let isDone = false;

  let isLoadable = true;

  let sleepPromise = RESOLVED_PROMISE;

  let resume: () => void;

  const root = injectAsync(prev) as PollableRoot;

  const state: AnyPollableState = { r: root, p: EMPTY_ARR };

  const _setValue = root.get(RootKey.VALUE_SET)!;

  const slowLoadingSet = (loadingTimeout && new Set()) as CallbackSet;

  const getVisibleInterval = handleGetInterval(interval, root);

  const load = async (arg: any) => {
    if (!isPolling) {
      isPolling = true;

      isLoadable = false;

      const cancelPromise = new Promise<void>((res) => {
        cancel = () => {
          isPolling = false;

          cancel = noop;

          res();
        };
      });

      setLoad(state, false);

      do {
        do {
          await Promise.any([
            Promise.all([sleepPromise, pausePromise, becomingOnline()]),
            cancelPromise,
          ]);
        } while (isPolling && (pausePromise || !navigator.onLine));

        if (isPolling) {
          const promise = Promise.any([
            fetcher(arg)
              .then((value) => {
                setValue(state, value);

                sleepPromise = sleep(getInterval);
              })
              .catch((err) => {
                setError(state, err);
              }),
            cancelPromise,
          ]);

          await (loadingTimeout
            ? withSlowLoading(promise, loadingTimeout, slowLoadingSet)
            : promise);
        }
      } while (isPolling);
    }
  };

  const handleLoad = (arg: any) => {
    if (isLoadable) {
      load(arg);

      return () => {
        if (!isDone) {
          isLoadable = true;
        }

        cancel();
      };
    }
  };

  if (hiddenInterval == null) {
    sleep = commonSleep;

    getInterval = getVisibleInterval;
  } else {
    const getHiddenInterval = handleGetInterval(hiddenInterval, root);

    getInterval = () =>
      (document.hidden ? getHiddenInterval : getVisibleInterval)();

    sleep = changingSleep;
  }

  root.set(RootKey.POLLING_PAUSE, () => {
    if (!pausePromise) {
      pausePromise = new Promise((res) => {
        resume = res;
      });
    }
  });

  root.set(RootKey.POLLING_RESUME, () => {
    if (pausePromise) {
      pausePromise = false;

      resume();
    }
  });

  root.set(RootKey.VALUE_SET, (nextValue, rootValue, isSet, path, isError) => {
    _setValue(nextValue, rootValue, isSet, path, isError);

    if (isSet) {
      isDone = until(root.get(RootKey.VALUE));

      if (isDone) {
        cancel();

        setLoad(state, true);
      } else if (!isPolling) {
        isLoadable = true;
      }
    } else {
      isDone = isError;

      if (isDone) {
        cancel();
      } else if (!isPolling) {
        isLoadable = true;
      }

      setLoad(state, isError);
    }
  });

  root.set(RootKey.LOAD, handleLoad);
};

const commonSleep = (getInterval: () => number) =>
  new Promise<void>((res) => {
    setTimeout(res, getInterval());
  });

const changingSleep = (getInterval: () => number) =>
  new Promise<void>((res) => {
    const listener = () => {
      window.clearTimeout(timeoutId);

      const delay = getInterval();

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

    const delay = getInterval();

    let timeoutId: number | undefined;

    let start = performance.now();

    document.addEventListener('visibilitychange', listener);

    if (delay > 0) {
      timeoutId = window.setTimeout(resolve, delay);
    }
  });

const withSlowLoading = async (
  promise: Promise<any>,
  loadingTimeout: number,
  slowLoadingSet: CallbackSet
) => {
  let slowLoadingTimeoutId = window.setTimeout(() => {
    executeSetters(slowLoadingSet);
  }, loadingTimeout);

  await promise;

  window.clearTimeout(slowLoadingTimeoutId);
};

const toKey = (value: any) => {
  if (value instanceof Date) {
    return value.getDate();
  }

  let str = '\v';

  if (Array.isArray(value)) {
    for (let i = value.length; i--; ) {
      const child = value[i];

      str = `${str}${child && typeof child == 'object' ? toKey(child) : child},`;
    }
  } else {
    const keys = Object.keys(value).sort();

    for (let i = keys.length; i--; ) {
      const key = keys[i];

      const child = value[key];

      if (child !== undefined) {
        str = `${str}${key}:${child && typeof child == 'object' ? toKey(child) : child};`;
      }
    }
  }

  return str + '\f';
};

const handleVersionedStorage = () => {
  const storage: StorageMap = new Map();

  const versionStorage = new Map<Key, any>();

  return (version: any) => {
    if (storage.has(version)) {
      return storage.get(version)!;
    }

    if (typeof version == 'object') {
      const stringifiedVersion = toKey(version);

      if (versionStorage.has(stringifiedVersion)) {
        const prevVersion = versionStorage.get(stringifiedVersion)!;

        if (storage.has(prevVersion)) {
          const root = storage.get(prevVersion)!;

          storage.delete(prevVersion);

          storage.set(version, root);

          return root;
        }
      } else {
        versionStorage.set(stringifiedVersion, version);
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
  storage: NestedMap | undefined | false
): ((key: Key) => boolean) | false => {
  if (storage && storage.size > 1) {
    let equalList: Set<Key> | false = new Set();

    forEachChild(storage, (key) => {
      const child = storage.get(key)!;

      const newValue = nextValue[key];

      if (handleNotEqual(prevValue[key], newValue, child)) {
        equalList = false;

        executeSetters(child.get(EMPTY_ARR)!, newValue);
      } else if (equalList) {
        equalList.add(key);
      }
    });

    return equalList && equalList.has.bind(equalList);
  }

  return alwaysFalse;
};

const handleNil = (prevValue: any, nextValue: any, storage: NestedMap) => {
  executeSetters(storage.get(EMPTY_ARR)!, nextValue);

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
  storage: NestedMap | undefined | false
) => {
  if (prevValue === nextValue) {
    return false;
  }

  if (prevValue == null || nextValue == null) {
    if (storage) {
      handleNil(prevValue, nextValue, storage);
    }

    return true;
  }

  const aPrototype = Object.getPrototypeOf(prevValue);

  if (aPrototype != Object.getPrototypeOf(nextValue)) {
    if (storage) {
      executeSetters(storage.get(EMPTY_ARR)!, nextValue);

      handleMandatoryCheck(prevValue, nextValue, storage);
    }

    return true;
  }

  if (aPrototype == Object.prototype) {
    const isChecked = handleMandatoryCheck(prevValue, nextValue, storage);

    if (!isChecked) {
      return true;
    }

    const aKeys = Object.keys(prevValue);

    let i = aKeys.length;

    if (i != Object.keys(nextValue).length) {
      return true;
    }

    const getStorage = storage
      ? (storage.get.bind(storage) as (typeof storage)['get'])
      : alwaysFalse;

    while (i--) {
      const key = aKeys[i];

      if (
        !isChecked(key) &&
        handleNotEqual(prevValue[key], nextValue[key], getStorage(key))
      ) {
        return true;
      }
    }

    return false;
  }

  if (Array.isArray(prevValue)) {
    const isChecked = handleMandatoryCheck(prevValue, nextValue, storage);

    if (!isChecked) {
      return true;
    }

    const l = prevValue.length;

    if (l != nextValue.length) {
      return true;
    }

    const getStorage = storage
      ? (storage.get.bind(storage) as (typeof storage)['get'])
      : alwaysFalse;

    for (let i = 0; i < l; i++) {
      if (
        !isChecked(i) &&
        handleNotEqual(prevValue[i], nextValue[i], getStorage(i))
      ) {
        return true;
      }
    }

    return false;
  }

  if (prevValue instanceof Date) {
    return prevValue.getTime() != nextValue.getTime();
  }

  return true;
};

const executeSetters = (set: CallbackSet, value?: unknown) => {
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

const deleteError = (root: AsyncRoot) => {
  if (root.delete(RootKey.ERROR)) {
    executeSetters(root.get(RootKey.ERROR_CALLBACK_SET)!, undefined);
  }
};

const deleteValue = (root: Root, isError: boolean) => {
  if (root.has(RootKey.VALUE)) {
    const rootValue = root.get(RootKey.VALUE)!;

    root.delete(RootKey.VALUE);

    root.get(RootKey.VALUE_SET)!(
      undefined,
      rootValue,
      false,
      EMPTY_ARR,
      isError
    );
  }
};

const createUseValueOf =
  (
    onValueChanged: ReturnType<typeof createOnValueOfChange>,
    getValue: ReturnType<typeof createGetValueOf>
  ) =>
  (state: _SimplifiedState | Falsy) => {
    if (state) {
      const t = useState<{}>();

      useLayoutEffect(() => {
        const forceRerender = t[1];

        return onValueChanged(state, () => {
          forceRerender({});
        });
      }, [state.r, 0]);

      return getValue(state);
    }

    useNoop();
  };

const createGetValueOf = (valueKey: ValueKey) => (state: _SimplifiedState) =>
  state.r.get(valueKey);

const createOnValueOfChange =
  (setKey: Exclude<SetKey, RootKey.VALUE_GET_CALLBACK_SET>) =>
  (state: _SimplifiedState, cb: (value: any) => void) => {
    const set = state.r.get(setKey)!;

    set.add(cb);

    return () => {
      set.delete(cb);
    };
  };

export const setValue = <S extends AnyState>(
  state: S,
  value: S extends AnyState<infer T> ? T : never
) => {
  const root = state.r;

  const rootValue = root.get(RootKey.VALUE);

  root.get(RootKey.VALUE_SET)!(
    typeof value != 'function' ? value : value(rootValue),
    rootValue,
    true,
    state.p!,
    false
  );

  deleteError(root as AsyncRoot);

  return state;
};

export const getValue = <T>(state: AnyState<T>): T => {
  const root = state.r;

  return root.get(RootKey.VALUE_GET)!(root.get(RootKey.VALUE), state.p!);
};

export const onValueChange = <T>(
  state: AnyState<T>,
  cb: (value: T) => void
) => {
  const set = state.r.get(RootKey.VALUE_GET_CALLBACK_SET)!(state.p!);

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const root = state.r;

    const t = useState<{}>();

    useLayoutEffect(() => {
      const forceRerender = t[1];

      const unlistenValue = onValueChange(state, () => {
        forceRerender({});
      });

      if (root.has(RootKey.HANDLE_LISTENERS)) {
        const unlistenListeners = root.get(RootKey.HANDLE_LISTENERS)!({
          ...state,
          p: EMPTY_ARR,
        });

        return () => {
          unlistenValue();

          unlistenListeners();
        };
      }

      return unlistenValue;
    }, [root, state.p && state.p.join('.')]);

    return getValue(state);
  }

  useNoop();
}) as {
  <S extends AnyState | Falsy>(
    state: S
  ): S extends AnyState<infer T> ? T : undefined;
};

export const use = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const root = state.r;

    if (root.has(RootKey.VALUE)) {
      const t = useState<{}>();

      useLayoutEffect(() => {
        const setValue = t[1];

        const forceRerender = () => {
          setValue({});
        };

        const unlistenValue = onValueChange(state, forceRerender);

        const unlistenError = onError(state, forceRerender);

        const unlistenListeners = root.has(RootKey.HANDLE_LISTENERS)
          ? root.get(RootKey.HANDLE_LISTENERS)!({ ...state, p: EMPTY_ARR })
          : noop;

        return () => {
          unlistenValue();

          unlistenError();

          unlistenListeners();
        };
      }, [root, state.p && state.p.join('.')]);

      return getValue(state);
    }

    if (root.has(RootKey.ERROR)) {
      throw root.get(RootKey.ERROR);
    }

    throw getPromise({ r: root, p: EMPTY_ARR }).finally(
      root.get(RootKey.LOAD)!(state.v)!
    );
  }

  useNoop();
}) as {
  <S extends AnyAsyncState | Falsy>(
    state: S
  ): S extends AnyAsyncState<infer T> ? T : undefined;
};

const RESOLVED_PROMISE = Promise.resolve();

export const useAll = ((...states: (AnyAsyncState | Falsy)[]) => {
  const l = states.length;

  const values: any[] = [];

  const setValue = useState<{}>()[1];

  const forceRerender = () => {
    setValue({});
  };

  for (let i = 0; i < l; i++) {
    const state = states[i];

    if (state) {
      const root = state.r;

      if (root.has(RootKey.ERROR)) {
        throw root.get(RootKey.ERROR)!;
      }

      if (!root.has(RootKey.VALUE)) {
        const promises = [getPromise(state)];

        for (++i; i < l; i++) {
          const state = states[i];

          if (state) {
            const root = state.r;

            if (root.has(RootKey.ERROR)) {
              throw root.get(RootKey.ERROR);
            }

            if (!root.has(RootKey.VALUE)) {
              promises.push(getPromise(state));
            }
          }
        }

        throw Promise.all(promises);
      }

      useLayoutEffect(() => {
        const unlistenValue = onValueChange(state, forceRerender);

        const unlistenError = onError(state, forceRerender);

        return () => {
          unlistenValue();

          unlistenError();
        };
      }, [root, state.p && state.p.join('.')]);

      values.push(getValue(state));
    } else {
      values.push(useLayoutEffect(noop, [0, 0]));
    }
  }

  return values;
}) as {
  <S extends (AnyAsyncState | Falsy)[]>(...states: S): ValuesOf<S>;
};

type ValuesOf<T> = T extends [infer Head, ...infer Tail]
  ? [Head extends AnyAsyncState<infer K> ? K : undefined, ...ValuesOf<Tail>]
  : [];

export const getPromise = <T>(state: AnyAsyncState<T>): Promise<T> => {
  const root = state.r;

  const path = state.p;

  let promise: Promise<any>;

  if (root.has(RootKey.PROMISE)) {
    promise = root.get(RootKey.PROMISE)!;
  } else {
    const valueSet = root.get(RootKey.VALUE_GET_CALLBACK_SET)!(EMPTY_ARR);

    const errorSet = root.get(RootKey.ERROR_CALLBACK_SET)!;

    promise = (
      root.has(RootKey.VALUE)
        ? Promise.resolve(root.get(RootKey.VALUE)!)
        : root.has(RootKey.ERROR)
          ? Promise.reject(root.get(RootKey.ERROR))
          : new Promise<any>((res, rej) => {
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
  }

  return path && path.length
    ? promise.then((value) => root.get(RootKey.VALUE_GET)!(value, path))
    : promise;
};

export const setLoad = createPrimitiveSetter(
  RootKey.IS_LOADED,
  RootKey.IS_LOADED_CALLBACK_SET
) as {
  <S extends AnyAsyncState>(state: S, isLoaded: boolean): S;
};

export const isLoaded = createGetValueOf(RootKey.IS_LOADED) as {
  (state: AnyAsyncState): boolean;
};

export const onLoad = createOnValueOfChange(RootKey.IS_LOADED_CALLBACK_SET) as {
  (state: AnyAsyncState, cb: (isLoaded: boolean) => void): () => void;
};

export const useIsLoaded = createUseValueOf(onLoad, isLoaded) as {
  <S extends AnyAsyncState | Falsy>(
    state: S
  ): S extends AnyAsyncState ? boolean : undefined;
};

export const setError = <S extends AnyAsyncState>(
  state: S,
  error: S extends AnyAsyncState<any, infer E> ? E : never
) => {
  const root = state.r;

  deleteValue(root, true);

  if (!root.has(RootKey.ERROR) || root.get(RootKey.ERROR)! !== error) {
    root.set(RootKey.ERROR, error);

    executeSetters(root.get(RootKey.ERROR_CALLBACK_SET)!, error);
  }

  return state;
};

export const getError = createGetValueOf(RootKey.ERROR) as {
  <E>(state: AnyAsyncState<any, E>): E;
};

export const onError = createOnValueOfChange(RootKey.ERROR_CALLBACK_SET) as {
  <E>(state: AnyAsyncState<any, E>, cb: (error: E) => void): () => void;
};

export const useError = createUseValueOf(onError, getError) as {
  <S extends AnyAsyncState | Falsy>(
    state: S
  ): S extends AnyAsyncState<any, infer E> ? E : undefined;
};

export const clear = <S extends AnyAsyncState>(state: S) => {
  deleteValue(state.r, false);

  deleteError(state.r);

  return state;
};

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

let becomeOnlinePromise: Promise<void> | undefined | false;

const becomingOnline = () =>
  navigator.onLine
    ? RESOLVED_PROMISE
    : becomeOnlinePromise ||
      (becomeOnlinePromise = new Promise<void>((res) => {
        window.addEventListener(
          'online',
          () => {
            becomeOnlinePromise = false;

            res();
          },
          { once: true }
        );
      }));

const executeFetcher = async (
  fetcher: (arg?: any) => Promise<any>,
  arg: any,
  root: LoadableRoot,
  slowLoadingSet: CallbackSet,
  loadingTimeout: number | undefined
) => {
  let slowLoadingTimeoutId: number | undefined;

  if (loadingTimeout) {
    slowLoadingTimeoutId = window.setTimeout(() => {
      executeSetters(slowLoadingSet);
    }, loadingTimeout);
  }

  return fetcher(arg)
    .then((value) => {
      setValue({ r: root, p: EMPTY_ARR }, value);
    })
    .catch((err) => {
      setError({ r: root }, err);
    })
    .then(() => {
      if (loadingTimeout) {
        window.clearTimeout(slowLoadingTimeoutId);
      }
    });
};

const beforeLoad = (
  root: LoadableRoot,
  dedupingInterval: number | undefined
) => {
  if (dedupingInterval) {
    window.clearTimeout(root.get(RootKey.DEDUPING_TIMEOUT_ID));
  }

  root.set(RootKey.IS_FREE, false);

  root.set(RootKey.IS_DEDUPLICATED, false);

  root.set(RootKey.IS_LOADED, false);

  executeSetters(root.get(RootKey.IS_LOADED_SET)!, false);
};

const afterLoad = (
  root: LoadableRoot,
  dedupingInterval: number | undefined
) => {
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
  root: PollableRoot,
  slowLoadingSet: CallbackSet,
  loadingTimeout: number | undefined,
  getPause: () => Promise<void>,
  sleep: (root: Root) => Promise<void>
) => {
  while (root.get(RootKey.IS_BUSY)) {
    await getPause();

    await becomingOnline();

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

const handleGetInterval = (
  interval: number | ((value: any) => number),
  root: Root
) =>
  typeof interval == 'number'
    ? () => interval
    : () => interval(root.get(RootKey.VALUE));

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

const getIsLoaded = (root: AsyncRoot) => root.get(RootKey.IS_LOADED)!;

const getIsLoadedSet = (root: Root) => root.get(RootKey.IS_LOADED_SET)!;

function path<T extends NestedState | VersionedNestedState<any>>(
  this: T,
  ...path: any[]
): T {
  const prevPath = this.p;

  return path.length
    ? { ...this, p: prevPath.length ? prevPath.concat(...path) : path }
    : this;
}

export const createState = <T>(): State<T> => ({ r: createPrimitiveRoot() });

export const createNestedState = <T>(): NestedState<T> => ({
  r: createRoot(),
  p: EMPTY_ARR,
  path,
});

export const createVersionedNestedState = <V, T>(): VersionedNestedState<
  V,
  T
> => {
  const getRoot = handleVersionedStorage();

  return {
    p: EMPTY_ARR,
    path,
    of(version): any {
      if (version != null) {
        return { ...this, r: getRoot(version), v: version };
      }
    },
  };
};

export const createVersionedStateaw = <V, T, E = any>(
  options: Options<V, T>
) => {
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
