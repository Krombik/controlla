import type { ReadonlyAsyncControl, Control } from '#types';
import { INTERNALS } from '#shared-internal/constants';

const selectError = <E>(control: ReadonlyAsyncControl<any, E>): Control<E> =>
  control[INTERNALS]._root._errorControl as any;

export default selectError;
