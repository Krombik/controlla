import { useLayoutEffect, useState } from 'react';
import noop from 'lodash.noop';
import { kek } from './types';

type Key = string | number;

const SET_KEY = Symbol();

const enum RootKey {
  MAP,
  VALUE,
  ERROR,
  PROMISE,
}

type Start = 0 | 1;

type SetMap = Map<typeof SET_KEY, Set<(value: unknown) => void>>;

type CommonMap = SetMap & Map<Key, NestedMap>;

type NestedMap = CommonMap;

type Root = Map<RootKey.MAP, CommonMap> &
  Map<RootKey.VALUE, unknown> &
  Map<RootKey.ERROR, unknown> &
  Map<typeof SET_KEY, Set<(error: unknown) => void>> &
  Map<RootKey.PROMISE, Promise<unknown>>;

type StorageMap = Map<Key, Root>;

const safeGet = (value: any, path: any[], start: number = 0, end: number) => {
  for (let i = start; i < end; i++) {
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

  root.set(SET_KEY, new Set());

  return root;
};

const getRoot = (storage: StorageMap, key: Key) => {
  if (storage.has(key)) {
    return storage.get(key)!;
  }

  const root = createRoot();

  storage.set(key, root);

  return root;
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

      executeSetters(child, newValue);
    } else if (equalList) {
      equalList.add(key);
    }
  });

  return equalList && equalList.has.bind(equalList);
};

const handleNil = (prevValue: any, nextValue: any, storage: NestedMap) => {
  executeSetters(storage, nextValue);

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
      executeSetters(storage, nextValue);

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
  args: any[],
  index: number,
  end: number,
  push: (value: any) => any
): any => {
  let newValue;

  if (index < end) {
    const k = args[index++] as Key;

    if (prevValue == null || typeof prevValue != 'object') {
      prevValue = typeof k == 'string' ? {} : [];
    }

    if (Array.isArray(prevValue)) {
      newValue = prevValue.slice();

      newValue[k as number] = getNewRootValue(
        prevValue[k as number],
        args,
        index,
        end,
        push
      );
    } else {
      newValue = {
        ...prevValue,
        [k]: getNewRootValue(prevValue[k], args, index, end, push),
      };
    }
  } else {
    newValue = args[end];
  }

  push(newValue);

  return newValue;
};

const executeSetters = (storage: SetMap, value: unknown) => {
  const set = storage.get(SET_KEY)!;

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

const getMap = (root: Root, path: any[], i: number, end: number) => {
  let parent = root.get(RootKey.MAP)!;

  for (; i < end; i++) {
    const k: Key = path[i];

    if (!parent.has(k)) {
      for (; i < end; i++) {
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
    executeSetters(root, undefined);
  }
};

const deleteValue = (root: Root) => {
  if (root.has(RootKey.VALUE)) {
    safeSet(root, [0, undefined], 1);

    root.delete(RootKey.VALUE);
  }
};

const safeSet = (root: Root, args: any[], start: Start) => {
  const l = args.length - 1;

  const rootMap = root.get(RootKey.MAP)!;

  const nodesQueue: NestedMap[] = [rootMap];

  const valuesQueue: any[] = [];

  const rootValue = root.get(RootKey.VALUE);

  const prevValue = safeGet(rootValue, args, start, l);

  let currentNode: NestedMap | undefined = rootMap;

  let isNotUpdated = true;

  for (let i = start; i < l; i++) {
    const k = args[i] as Key;

    if (currentNode.has(k)) {
      nodesQueue.push((currentNode = currentNode.get(k)!));
    } else {
      currentNode = undefined;

      break;
    }
  }

  if (
    handleNotEqual(prevValue, args[l], currentNode, (): true => {
      if (isNotUpdated) {
        root.set(
          RootKey.VALUE,
          getNewRootValue(
            rootValue,
            args,
            start,
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
      executeSetters(nodesQueue[i], valuesQueue[i]);
    }
  }
};

const getPromise = (root: Root) => {
  if (root.has(RootKey.PROMISE)) {
    return root.get(RootKey.PROMISE)!;
  }

  const valueSet = root.get(RootKey.MAP)!.get(SET_KEY)!;

  const errorSet = root.get(SET_KEY)!;

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

const addToSet = (root: SetMap, cb: (value: unknown) => void) => {
  const set = root.get(SET_KEY)!;

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

const _set = (root: Root, args: any[], start: Start) => {
  deleteError(root);

  safeSet(root, args, start);
};

const _get = (root: Root, args: any[], start: Start) =>
  safeGet(root.get(RootKey.VALUE), args, start, args.length);

const _use = (root: Root, args: any[], start: Start) => {
  let end = args.length;

  let isEnabled: true | undefined = true;

  const forceRerender = useState<{}>()[1];

  const last = args[end - 1];

  if (typeof last == 'boolean') {
    end--;

    isEnabled = !last || undefined;
  }

  useLayoutEffect(
    () =>
      isEnabled &&
      addToSet(getMap(root, args, start, end), () => {
        forceRerender({});
      }),
    args
  );

  return isEnabled && safeGet(root.get(RootKey.VALUE), args, start, end);
};

const _delete = (root: Root) => {
  deleteError(root);

  deleteValue(root);
};

const _setError = (root: Root, error: any) => {
  deleteValue(root);

  root.set(RootKey.ERROR, error);

  executeSetters(root, error);
};

const _useError = (root: Root) => {
  const forceRerender = useState<{}>()[1];

  useLayoutEffect(
    () =>
      addToSet(root, () => {
        forceRerender({});
      }),
    [root]
  );

  return root.get(RootKey.ERROR);
};

const _onChange = (root: Root, args: any[], start: Start) => {
  const l = args.length - 1;

  return addToSet(
    getMap(root, args, start, l),
    args[l] as (value: unknown) => void
  );
};

const _suspense = (root: Root, args: any[], start: Start) => {
  let end = args.length;

  let isEnabled = true;

  const last = args[end - 1];

  if (typeof last == 'boolean') {
    end--;

    isEnabled = !last;
  }

  if (isEnabled && root.has(RootKey.VALUE)) {
    const t = useState<{}>();

    useLayoutEffect(() => {
      const setValue = t[1];

      const forceRerender = () => {
        setValue({});
      };

      const valueSet = getMap(root, args, start, end).get(SET_KEY)!;

      const errorSet = root.get(SET_KEY)!;

      valueSet.add(forceRerender);

      errorSet.add(forceRerender);

      return () => {
        valueSet.delete(forceRerender);

        errorSet.delete(forceRerender);
      };
    }, args);

    return safeGet(root.get(RootKey.VALUE), args, start, end);
  }

  useState();

  useLayoutEffect(noop, Array(args.length));

  if (isEnabled) {
    throw root.has(RootKey.ERROR) ? root.get(RootKey.ERROR) : getPromise(root);
  }
};

export const createVersionedStorage = <T>(): kek<T> => {
  const storage: StorageMap = new Map();

  const start = 1;

  return {
    set(...args) {
      _set(getRoot(storage, args[0]), args, start);
    },
    get(...args) {
      return _get(getRoot(storage, args[0]), args, start);
    },
    use(...args) {
      return _use(getRoot(storage, args[0]), args, start);
    },
    delete(version) {
      _delete(getRoot(storage, version));
    },
    getPromise(version) {
      return getPromise(getRoot(storage, version));
    },
    setError(version, error) {
      _setError(getRoot(storage, version), error);
    },
    getError(version) {
      return getRoot(storage, version).get(RootKey.ERROR);
    },
    useError(version) {
      return _useError(getRoot(storage, version));
    },
    onChange(...args) {
      return _onChange(getRoot(storage, args[0]), args, start);
    },
    onError(version, cb) {
      return addToSet(getRoot(storage, version), cb);
    },
    suspense(...args) {
      return _suspense(getRoot(storage, args[0]), args, start);
    },
  };
};

type Obj = {
  k: {
    a: { b: number };
    j: { c: [kek: number, bek: {}] };
  };
  l: string;
};

createVersionedStorage<Obj>().get('k', 'j', 'c', 1);
