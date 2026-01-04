import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { ROOT } from '#shared/constants';

const getValue = <S extends ReadonlyControl>(
  control: S
): S extends ReadonlyControl<infer K>
  ? K | (S extends ReadonlyAsyncControl ? undefined : never)
  : never => control[ROOT]._get();

export default getValue;
