import { Dimensions, type DimensionsPayload } from 'react-native';

import createControl from '#core/createControl';
import scheduleSet from '#internal/scheduleSet';
import { INTERNALS, PASSIVE } from '#internal/constants';
import type { ControlScope, ReadonlyControlScope } from '#types';

type Size = { width: number; height: number };

const getSize = (): Size => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const $windowSize: ControlScope<Size> = createControl<Size>(
  __NATIVE__
    ? Dimensions.get('window')
    : typeof window != 'undefined'
      ? getSize()
      : { width: 0, height: 0 }
);

const root = $windowSize[INTERNALS]._root;

if (__NATIVE__) {
  // react-native types the handler as a bare `Function`, and the payload as
  // carrying either metric or neither
  Dimensions.addEventListener(
    'change',
    ({ window: size }: DimensionsPayload) => {
      if (size) {
        scheduleSet(root, size, true, requestAnimationFrame);
      }
    }
  );
} else if (typeof window != 'undefined') {
  const listener = () => {
    scheduleSet(root, getSize(), true, requestAnimationFrame);
  };

  window.addEventListener('resize', listener, PASSIVE);

  window.addEventListener('orientationchange', listener, PASSIVE);
}

/**
 * Control of the size of the window the app is drawn in, kept in sync as it
 * changes (committed once per animation frame). `width`/`height` are nested
 * controls — subscribe to one without re-rendering on the other.
 */
export default $windowSize as ReadonlyControlScope<Size>;
