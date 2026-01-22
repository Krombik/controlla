import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  Control,
  Storage,
  AsyncControlOptions,
  RequestableControlOptions,
  PollableControlOptions,
  LoadableControlOptions,
  PollableControlScope,
  LoadableControlScope,
  AsyncControlScope,
  ControlScope,
  SyncExternalStorage,
} from '#types';
import type { ControlRoot, WithInitModule } from '#_types';
import type createControl from '#@/createControl';
import type createAsyncControl from '#@/createAsyncControl';
import type createRequestableControl from '#@/createRequestableControl';
import type createPollableControl from '#@/createPollableControl';
import { ROOT } from '#shared/constants';

interface CreateStorage {
  <T, Keys extends PrimitiveOrNested[], E = any, Control = never>(
    ...args: WithInitModule<
      T | undefined,
      [
        createAsyncControl: typeof createAsyncControl,
        options: LoadableControlOptions<T, E, Control, Keys>,
      ]
    >
  ): Storage<LoadableControlScope<T, E, Control>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createPollableControl: typeof createPollableControl,
        options: PollableControlOptions<T, Keys>,
      ]
    >
  ): Storage<PollableControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createAsyncControl: typeof createAsyncControl,
        options?: AsyncControlOptions<T, Keys>,
      ]
    >
  ): Storage<AsyncControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createRequestableControl: typeof createRequestableControl,
        options: RequestableControlOptions<T, Keys>,
      ]
    >
  ): Storage<LoadableControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: WithInitModule<
      T,
      [
        createControl: typeof createControl,
        defaultValue?: T | ((keys: Keys) => T),
      ]
    >
  ): Storage<ControlScope<T>, Keys>;
}

const handleChildren = (
  item: Map<any, any> | Control,
  name: Extract<keyof ControlRoot, '_enqueueSet' | '_unobserve'>
) => {
  if (item instanceof Map) {
    const queue: Map<any, any>[] = [item];

    const push = queue.push.bind(queue);

    const pop = queue.pop.bind(queue);

    while (queue.length) {
      const item = pop()!;

      let i = item.size;

      if (i) {
        const it = item.values();

        const next = it.next.bind(it);

        const first: Map<any, any> | Control = next().value;

        if (first instanceof Map) {
          push(first);

          while (--i) {
            push(next().value);
          }
        } else {
          first[ROOT]._root[name]!();

          while (--i) {
            (next().value as Control)[ROOT]._root[name]!();
          }
        }
      }
    }
  } else {
    item[ROOT]._root[name]!();
  }
};

function _delete(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
  const self = this;

  let item = self._storage;

  const l = keys.length - 1;

  if (l < 0) {
    const isNotEmpty = !!item.size;

    item.clear();

    return isNotEmpty;
  }

  for (let i = 0; i < l; i++) {
    const _key = keys[i];

    const key = _key && typeof _key == 'object' ? toKey(_key) : _key;

    if (!item.has(key)) {
      return false;
    }

    item = item.get(key)!;
  }

  const _key = keys[l];

  const key = _key && typeof _key == 'object' ? toKey(_key) : _key;

  if (
    self._syncExternalStorage &&
    self._syncExternalStorage._observable &&
    item.has(key)
  ) {
    handleChildren(item.get(key)!, /* @__KEY__ */ '_unobserve');
  }

  return item.delete(key);
}

function clear(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
  let item = this._storage;

  const l = keys.length;

  for (let i = 0; i < l; i++) {
    const _key = keys[i];

    const key = _key && typeof _key == 'object' ? toKey(_key) : _key;

    if (!item.has(key)) {
      return;
    }

    item = item.get(key)!;
  }

  handleChildren(item, /* @__KEY__ */ '_enqueueSet');
}

function has(this: Storage<any, any>, ...keys: PrimitiveOrNested[]) {
  let item = this._storage;

  const l = keys.length - 1;

  for (let i = 0; i < l; i++) {
    const _key = keys[i];

    const key = _key && typeof _key == 'object' ? toKey(_key) : _key;

    if (!item.has(key)) {
      return false;
    }

    item = item.get(key)!;
  }

  const _key = keys[l];

  return item.has(_key && typeof _key == 'object' ? toKey(_key) : _key);
}

function get(this: Storage<any, any>, ...keys: any[]): any {
  const l = keys.length;

  const self = this;

  let item = self._storage;

  for (let i = 0; i < l; i++) {
    const _key = keys[i];

    const key = _key && typeof _key == 'object' ? toKey(_key) : _key;

    if (item.has(key)) {
      item = item.get(key)!;
    } else {
      const parentItem = item;

      item =
        i < l - 1
          ? new Map()
          : self._getItem(self._arg1, self._syncExternalStorage, keys);

      parentItem.set(key, item);
    }
  }

  return item;
}

const createStorage: CreateStorage = (
  getItem: any,
  arg1?: unknown,
  syncExternalStorage?: SyncExternalStorage
): any =>
  ({
    _storage: new Map(),
    delete: _delete,
    get,
    clear,
    has,
    _getItem: getItem,
    _arg1: arg1,
    _syncExternalStorage: syncExternalStorage,
  }) as Storage<any, any>;

export default createStorage;
