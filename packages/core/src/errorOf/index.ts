import type { ReadonlyAsyncControl, Control } from '#types';
import { ROOT } from '#shared/constants';

const errorOf = <E>(control: ReadonlyAsyncControl<any, E>): Control<E> =>
  control[ROOT]._root._errorControl as any;

export default errorOf;
