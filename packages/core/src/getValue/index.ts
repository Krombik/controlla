import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';

const getValue = <S extends ReadonlyControl>(
  control: S
): S extends ReadonlyControl<infer K>
  ? K | (S extends ReadonlyAsyncControl ? undefined : never)
  : never => control[INTERNALS]._get();

export default getValue;
