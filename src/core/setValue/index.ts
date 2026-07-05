import type { AsyncControl, Control, Scheduler } from '#types';
import { INTERNALS } from '#internal/constants';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import { getLane, scheduleFlush } from '#internal/flushQueue';

/**
 * Sets the {@link value} of the given {@link control} — directly or via an
 * updater function receiving the previous value. The commit is batched: it's
 * flushed by the {@link scheduler} (microtask by default) together with other
 * updates scheduled the same way, notifying only the paths that actually
 * changed.
 *
 * @example
 * ```ts
 * setValue($counter, 5);
 * setValue($counter, (prev) => prev + 1);
 * setValue($user.profile.name, 'Jane');   // nested controls are settable too
 * ```
 */
const setValue = <S extends Control>(
  control: S,
  value: S extends Control<infer K>
    ? K | ((prevValue: K | (S extends AsyncControl ? undefined : never)) => K)
    : never,
  scheduler: Scheduler = scheduleMicrotask
) => {
  const internals = control[INTERNALS];

  const lane = getLane(scheduler);

  internals._root._enqueueSet(
    typeof value != 'function' ? value : value(internals._get()),
    lane,
    internals._path
  );

  scheduleFlush(lane, scheduler);
};

export default setValue;
