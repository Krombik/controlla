import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#internal/constants';

/**
 * Returns the current value of the given {@link control} without subscribing
 * to changes. For an async control the value is `undefined` until ready.
 */
const getValue = <S extends ReadonlyControl>(
  control: S
): S extends ReadonlyControl<infer K>
  ? K | (S extends ReadonlyAsyncControl ? undefined : never)
  : never => control[INTERNALS]._get();

export default getValue;
