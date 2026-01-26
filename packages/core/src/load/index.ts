import { INTERNALS } from '#shared-internal/constants';
import type { LoadableControl } from '#types';

const load = (control: LoadableControl<any, any, any>, reload?: boolean) =>
  control[INTERNALS]._root._attachLoad(reload);

export default load;
