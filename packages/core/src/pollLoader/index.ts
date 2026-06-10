import type { PrimitiveOrNested } from 'keyweaver';
import type { AsyncControlOptions, LoadHandle, Scheduler } from '#types';
import removeFromArray from '#internal/removeFromArray';
import getStorageKey from '#internal/getStorageKey';
import type { Primitive } from 'keyweaver';
import toKey from 'keyweaver';

type Interval<T> = number | ((value: T | undefined) => number);

type Clock = {
  _timerId: ReturnType<typeof setTimeout> | undefined;
  _isRunning: boolean;
};

type Solo = Clock & {
  _isIdle: boolean;
  _run(): void;
};

type Group = Clock & {
  readonly _members: Array<(group: Group) => void>;
  readonly _scheduler: Scheduler | undefined;
  _barrier: number;
};

export type PollOptions<
  T,
  E,
  Keys extends PrimitiveOrNested[],
  SyncedKeysCount extends number = 0,
> = Omit<AsyncControlOptions<T, E, Keys>, 'load' | 'isLoaded'> &
  Required<Pick<AsyncControlOptions<T, E, Keys>, 'isLoaded'>> & {
    /** Polling interval in ms, or a function of the current value. */
    interval: SyncedKeysCount extends 0 ? Interval<T> : number;
    syncedKeysCount?: SyncedKeysCount extends KeysCountRange<Keys>
      ? SyncedKeysCount
      : KeysCountRange<Keys>;
    isolatedLanes?: SyncedKeysCount extends 0 ? never : boolean;
  };

type GroupKeys<
  Head extends any[],
  SyncedKeysCount extends number,
  Tail extends any[] = [],
> = Tail['length'] extends SyncedKeysCount
  ? Head
  : Head extends [...infer Head, any]
    ? GroupKeys<Head, SyncedKeysCount, [...Tail, any]>
    : never;

type KeysCountRange<T extends any[]> = T extends [any, ...infer R]
  ? T['length'] | KeysCountRange<R>
  : 0;

export type PollActions<
  Keys extends PrimitiveOrNested[],
  SyncedKeysCount extends number = 0,
> = {
  /** Pauses polling for the group owning the given group key. */
  pause(...groupKey: GroupKeys<Keys, SyncedKeysCount>): void;
  /** Resumes polling for the group owning the given group key. */
  resume(...groupKey: GroupKeys<Keys, SyncedKeysCount>): void;
  /** Immediately refetches the group owning the given group key and restarts its interval. */
  reset(...groupKey: GroupKeys<Keys, SyncedKeysCount>): void;
  /** @internal */
  readonly _storage: Map<Primitive, Group | Solo>;
  /** @internal */
  _fetch(...args: any[]): Promise<any>;
  /** @internal */
  readonly _scheduler: Scheduler | undefined;
  /** @internal */
  readonly _interval: Interval<any>;
  /** @internal */
  readonly _groupSize: number;
  /** @internal */
  readonly _isolatedLanes: boolean;
};

export type Poll<
  T,
  E,
  Keys extends PrimitiveOrNested[],
  SyncedKeysCount extends number = 0,
> = AsyncControlOptions<T, E, Keys> & {
  readonly actions: PollActions<Keys, SyncedKeysCount>;
};

const getKey = (keys: any[], groupSize: number, slice: boolean) =>
  groupSize
    ? groupSize > 1
      ? toKey(slice ? keys.slice(0, groupSize) : keys)
      : getStorageKey(keys[0])
    : 0;

const tickGroup = (group: Group, interval: number) => {
  const members = group._members;

  const membersCount = members.length;

  if (!--group._barrier && membersCount) {
    group._barrier = 1;

    group._timerId = setTimeout(() => {
      group._timerId = undefined;

      tickGroup(group, interval);
    }, interval);

    for (let i = 0; i < membersCount; i++) {
      members[i](group);
    }
  }
};

function groupLoad(
  this: Poll<any, any, any[], number>,
  handle: LoadHandle,
  keys: any[]
) {
  const self = this.actions;

  const fetch = self._fetch;

  const interval = self._interval as number;

  const groups = self._storage as Map<Primitive, Group>;

  const key = getKey(keys, self._groupSize, true);

  const request = (group: Group) => {
    group._barrier++;

    fetch(...keys).then(
      (value) => {
        if (handle.stillLoading() && handle.setValue(value, group._scheduler)) {
          tickGroup(group, interval);
        }
      },
      (error) => {
        if (handle.stillLoading()) {
          handle.setError(error, group._scheduler);
        }
      }
    );
  };

  let group = groups.get(key);

  if (group) {
    group._members.push(request);
  } else {
    const scheduler = self._scheduler;

    groups.set(
      key,
      (group = {
        _members: [request],
        _barrier: 1,
        _timerId: setTimeout(() => {
          group!._timerId = undefined;

          tickGroup(group!, interval);
        }, interval),
        _isRunning: true,
        _scheduler:
          scheduler &&
          (self._isolatedLanes
            ? (cb) => {
                scheduler(cb);
              }
            : scheduler),
      })
    );
  }

  request(group);

  return () => {
    const members = group._members;

    removeFromArray(members, request);

    if (members.length) {
      tickGroup(group, interval);
    } else {
      clearTimeout(group._timerId);

      groups.delete(key);
    }
  };
}

function groupPause(this: PollActions<any[], number>, ...keys: any[]) {
  const group = this._storage.get(getKey(keys, this._groupSize, false)) as
    | Group
    | undefined;

  if (group && group._isRunning) {
    group._isRunning = false;

    group._barrier++;
  }
}

function groupResume(this: PollActions<any[], number>, ...keys: any[]) {
  const self = this;

  const group = self._storage.get(getKey(keys, self._groupSize, false)) as
    | Group
    | undefined;

  if (group && !group._isRunning) {
    group._isRunning = true;

    tickGroup(group, self._interval as number);
  }
}

function groupReset(this: PollActions<any[], number>, ...keys: any[]) {
  const self = this;

  const group = self._storage.get(getKey(keys, self._groupSize, false)) as
    | Group
    | undefined;

  if (group && group._timerId != null) {
    clearTimeout(group._timerId);

    tickGroup(group, self._interval as number);
  }
}

function load(
  this: Poll<any, any, any[], number>,
  handle: LoadHandle,
  keys: any[]
) {
  const self = this.actions;

  const interval = self._interval;

  const fetch = self._fetch;

  const scheduler = self._scheduler;

  const storage = self._storage;

  const key = getKey(keys, self._groupSize, false);

  const schedule = () => {
    item._timerId = setTimeout(
      () => {
        item._timerId = undefined;

        if (item._isIdle && item._isRunning) {
          request();
        }
      },
      typeof interval == 'number' ? interval : interval(handle.getValue())
    );
  };

  const request = () => {
    item._isIdle = false;

    fetch(...keys).then(
      (value) => {
        item._isIdle = true;

        if (
          handle.stillLoading() &&
          handle.setValue(value, scheduler) &&
          item._isRunning &&
          item._timerId == null
        ) {
          schedule();
        }
      },
      (error) => {
        item._isIdle = true;

        if (handle.stillLoading()) {
          handle.setError(error, scheduler);
        }
      }
    );
  };

  const item: Solo = {
    _isRunning: true,
    _isIdle: true,
    _timerId: undefined,
    _run: request,
  };

  storage.set(key, item);

  request();

  return () => {
    item._isIdle = true;

    clearTimeout(item._timerId);

    storage.delete(key);
  };
}

function pause(this: PollActions<any[], number>, ...keys: any[]) {
  const item = this._storage.get(getKey(keys, this._groupSize, false)) as
    | Solo
    | undefined;

  if (item) {
    item._isRunning = false;
  }
}

function resume(this: PollActions<any[], number>, ...keys: any[]) {
  const item = this._storage.get(getKey(keys, this._groupSize, false)) as
    | Solo
    | undefined;

  if (item && !item._isRunning) {
    item._isRunning = true;

    if (item._isIdle && item._timerId == null) {
      item._run();
    }
  }
}

function reset(this: PollActions<any[], number>, ...keys: any[]) {
  const item = this._storage.get(getKey(keys, this._groupSize, false)) as
    | Solo
    | undefined;

  if (item && item._timerId != null) {
    clearTimeout(item._timerId);

    item._timerId = undefined;

    item._run();
  }
}

const pollLoader = <
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
  const SyncedKeysCount extends number = 0,
>(
  fetch: (...args: Keys) => Promise<T>,
  options: PollOptions<T, E, Keys, SyncedKeysCount>,
  scheduler?: Scheduler
): Poll<T, E, Keys, SyncedKeysCount> => {
  const { syncedKeysCount } = options;

  const keysCount = fetch.length;

  return {
    ...options,
    load: (syncedKeysCount ? groupLoad : load) as any,
    actions: {
      _isolatedLanes: options.isolatedLanes || false,
      _fetch: fetch,
      _interval: options.interval,
      _scheduler: scheduler,
      _groupSize: syncedKeysCount ? keysCount - syncedKeysCount : keysCount,
      _storage: new Map(),
      pause: syncedKeysCount ? groupPause : pause,
      reset: syncedKeysCount ? groupReset : reset,
      resume: syncedKeysCount ? groupResume : resume,
    },
  };
};

pollLoader(() => null!, { interval: 25, isLoaded: () => true });

export default pollLoader;
