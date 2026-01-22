import { ROOT } from '#shared/constants';
import type { LoadableControl } from '#types';

const load = (control: LoadableControl<any, any, any>, reload?: boolean) =>
  control[ROOT]._root._load(reload);

export default load;
