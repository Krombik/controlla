import type { AsyncControl, Control } from '#types';
import { ROOT } from '#shared/constants';

const setValue = <S extends Control>(
  control: S,
  value: S extends Control<infer K>
    ? K | ((prevValue: K | (S extends AsyncControl ? undefined : never)) => K)
    : never
) => {
  const utils = control[ROOT];

  (utils[ROOT] || utils)._set(
    typeof value != 'function' ? value : value(utils._get()),
    utils._path
  );
};

export default setValue;
