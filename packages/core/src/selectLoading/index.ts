import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';

const selectLoading = (
  control: ReadonlyAsyncControl
): ReadonlyControl<boolean> =>
  control[INTERNALS][INTERNALS]._loadingControl as any;

export default selectLoading;
