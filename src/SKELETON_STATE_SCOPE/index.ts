import type { LoadableStateScope } from '../types';
import { $tate } from '../utils/constants';
import SKELETON_STATE from '../SKELETON_STATE';

export type SkeletonStateScope = LoadableStateScope<any, any, any>;

/**
 * A special state scope that remains permanently in a pending state.
 */
const SKELETON_STATE_SCOPE = new Proxy(
  {},
  {
    get(_, prop, proxy) {
      return prop != $tate ? proxy : SKELETON_STATE;
    },
  }
) as SkeletonStateScope;

export default SKELETON_STATE_SCOPE;
