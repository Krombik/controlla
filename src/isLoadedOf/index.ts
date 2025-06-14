import type { ReadonlyAsyncControl, ReadonlyControl } from '../types';
import { ROOT } from '../utils/constants';

const isLoadedOf = (control: ReadonlyAsyncControl): ReadonlyControl<boolean> =>
  control[ROOT][ROOT]._isLoadedControl as any;

export default isLoadedOf;
