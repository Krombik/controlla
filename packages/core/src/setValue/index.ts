import type { AsyncControl, Control, Scheduler } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import scheduleMicrotask from '#internal/scheduleMicrotask';

const setValue = <S extends Control>(
  control: S,
  value: S extends Control<infer K>
    ? K | ((prevValue: K | (S extends AsyncControl ? undefined : never)) => K)
    : never,
  scheduler?: Scheduler
) => {
  const utils = control[INTERNALS];

  utils._root._enqueueSet(
    typeof value != 'function' ? value : value(utils._get()),
    scheduler || scheduleMicrotask,
    utils._path
  );
};

export default setValue;
