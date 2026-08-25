import createPrimitiveControl from '#core/createPrimitiveControl';
import type { NavigationState } from '#router/types';
import type { ReadonlyControl } from '#types';

/** The last history action: `push`, `replace` or `pop` (with its delta). */
const $navigationState: ReadonlyControl<NavigationState> =
  createPrimitiveControl<NavigationState>({
    action: 'none',
    delta: 0,
  });

export default $navigationState;
