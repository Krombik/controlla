import type { PrimitiveOrNested } from 'keyweaver';
import type { AsyncControlOptions, LoadHandle, Scheduler } from '#types';
import removeFromArray from '#internal/removeFromArray';
import getStorageKey from '#internal/getStorageKey';
import toKey, { type Primitive } from 'keyweaver';

type Interval<T> = number | ((value: T | undefined) => number);

type Clock = {
  _timerId: ReturnType<typeof setTimeout> | undefined;
  _isRunning: boolean;
};

type Solo = Clock & {
  _isIdle: boolean;
  _request(): void;
};

type Group = Clock & {
  readonly _members: Array<(group: Group) => void>;
  readonly _scheduler: Scheduler | undefined;
  _pendingCount: number;
};

export type PollOptions<
  T,
  E,
  Keys extends PrimitiveOrNested[],
  SyncedKeysCount extends number = 0,
> = Omit<AsyncControlOptions<T, E, Keys>, 'load' | 'isLoaded'> &
  Required<Pick<AsyncControlOptions<T, E, Keys>, 'isLoaded'>> & {
    /** Polling interval in ms, or a function of the current value (number only when {@link syncedKeysCount} is set). */
    interval: SyncedKeysCount extends 0 ? Interval<T> : number;
    /**
     * Number of trailing keys whose controls poll in sync: controls sharing
     * the other (leading) keys form a group with one shared clock and refetch
     * together. Omit to poll each key set independently.
     */
    syncedKeysCount?: SyncedKeysCount extends KeysCountRange<Keys>
      ? SyncedKeysCount
      : KeysCountRange<Keys>;
    /** If `true`, each group commits its results on its own lane instead of sharing one. */
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
  /** Pauses polling under the given keys (the leading group keys when {@link PollOptions.syncedKeysCount syncedKeysCount} is set, the full keys otherwise). */
  pause(...groupKey: GroupKeys<Keys, SyncedKeysCount>): void;
  /** Resumes polling under the given keys. */
  resume(...groupKey: GroupKeys<Keys, SyncedKeysCount>): void;
  /** Immediately refetches under the given keys and restarts the interval. */
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

/** {@link AsyncControlOptions} built by {@link pollLoader}, with polling {@link PollActions actions} attached. */
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

  if (!--group._pendingCount && membersCount) {
    group._pendingCount = 1;

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
    group._pendingCount++;

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
        _pendingCount: 1,
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

    group._pendingCount++;
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
    _request: request,
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
      item._request();
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

    item._request();
  }
}

/**
 * Creates {@link AsyncControlOptions options} for an async control that polls:
 * {@link fetch} is called with the control's keys, and while the result isn't
 * {@link PollOptions.isLoaded loaded}, it's called again every
 * {@link PollOptions.interval interval}. Polling runs while the control is in
 * use and can be controlled via the returned
 * {@link PollActions actions} (`pause`/`resume`/`reset`).
 *
 * In a registry, {@link PollOptions.syncedKeysCount syncedKeysCount} makes
 * controls differing only in their trailing keys (e.g. a page number) poll in
 * sync on one clock. Pass a {@link scheduler} to batch result commits.
 *
 * @example
 * ```ts
 * const poll = pollLoader(
 *   (id: number) => fetch(`/api/jobs/${id}`).then((r) => r.json()),
 *   { interval: 5000, isLoaded: (job) => job.done }
 * );
 *
 * const jobRegistry = createRegistry(createAsyncControl, poll);
 *
 * poll.actions.pause(42);
 * ```
 */
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

export default pollLoader;
