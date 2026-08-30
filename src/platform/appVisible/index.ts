import { AppState } from 'react-native';

import createPrimitiveControl from '#core/createPrimitiveControl';
import scheduleSet from '#internal/scheduleSet';
import { INTERNALS } from '#internal/constants';
import type { Control, ReadonlyControl } from '#types';

const isVisible = () => document.visibilityState === 'visible';

const $appVisible: Control<boolean> = createPrimitiveControl(
  __NATIVE__
    ? AppState.currentState === 'active'
    : typeof document !== 'undefined'
      ? isVisible()
      : true
);

const root = $appVisible[INTERNALS]._root;

if (__NATIVE__) {
  // `inactive` is the app switcher and the incoming call - not in front of anyone
  AppState.addEventListener('change', (state) => {
    scheduleSet(root, state === 'active', true);
  });
} else if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    scheduleSet(root, isVisible(), true);
  });
}

/**
 * Boolean control tracking whether the app is in front of the user - on the
 * web, `document.visibilityState === 'visible'`.
 */
export default $appVisible as ReadonlyControl<boolean>;
