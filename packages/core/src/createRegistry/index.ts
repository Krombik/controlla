import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  Control,
  Registry,
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
import type { WithInitModule } from '#internal/types';
import type createControl from '#@/createControl';
import type createAsyncControl from '#@/createAsyncControl';
import type createRequestableControl from '#@/createRequestableControl';
import type createPollableControl from '#@/createPollableControl';
import { INTERNALS } from '#shared-internal/constants';
import invalidate from '#@/invalidate';

const handleChildren = (
  item: Map<any, any> | Control,
  method: (control: Control) => void
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
          method(first);

          while (--i) {
            method(next().value);
          }
        }
      }
    }
  } else {
    method(item);
  }
};

function _delete(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
  const self = this;

  let item = self._storage;

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

  const key = _key && typeof _key == 'object' ? toKey(_key) : _key;

  if (
    self._syncExternalStorage &&
    self._syncExternalStorage._observable &&
    item.has(key)
  ) {
    handleChildren(item.get(key)!, (control) => {
      control[INTERNALS]._root._unobserve!();
    });
  }

  return item.delete(key);
}

function clear(this: Registry<any, any[]>) {
  const self = this;

  const storage = self._storage;

  if (self._syncExternalStorage && self._syncExternalStorage._observable) {
    const it = storage.keys();

    for (let i = storage.size; i--; ) {
      self.delete(it.next().value);
    }
  } else {
    storage.clear();
  }
}

function _invalidate(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
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

  handleChildren(item, invalidate);
}

function has(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
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

function get(this: Registry<any, any>, ...keys: any[]): any {
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

const createRegistry: {
  <T, Keys extends PrimitiveOrNested[], E = any, Control = never>(
    ...args: WithInitModule<
      T | undefined,
      [
        createAsyncControl: typeof createAsyncControl,
        options: LoadableControlOptions<T, E, Control, Keys>,
      ]
    >
  ): Registry<LoadableControlScope<T, E, Control>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createPollableControl: typeof createPollableControl,
        options: PollableControlOptions<T, Keys>,
      ]
    >
  ): Registry<PollableControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createAsyncControl: typeof createAsyncControl,
        options?: AsyncControlOptions<T, Keys>,
      ]
    >
  ): Registry<AsyncControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createRequestableControl: typeof createRequestableControl,
        options: RequestableControlOptions<T, Keys>,
      ]
    >
  ): Registry<LoadableControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: WithInitModule<
      T,
      [
        createControl: typeof createControl,
        defaultValue?: T | ((keys: Keys) => T),
      ]
    >
  ): Registry<ControlScope<T>, Keys>;
} = (
  getItem: any,
  arg1?: unknown,
  syncExternalStorage?: SyncExternalStorage
): any =>
  ({
    _storage: new Map(),
    delete: _delete,
    get,
    invalidate: _invalidate,
    has,
    clear,
    _getItem: getItem,
    _arg1: arg1,
    _syncExternalStorage: syncExternalStorage,
  }) as Registry<any, any[]>;

export default createRegistry;
