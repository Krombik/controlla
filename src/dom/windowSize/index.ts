import createControl from '#core/createControl';
import setValue from '#core/setValue';
import { PASSIVE } from '#internal/constants';
import type { ControlScope, ReadonlyControlScope } from '#types';

type Size = { width: number; height: number };

const getSize = (): Size => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const $windowSize: ControlScope<Size> = createControl<Size>(
  typeof window !== 'undefined' ? getSize() : { width: 0, height: 0 }
);

if (typeof window !== 'undefined') {
  const listener = () => {
    setValue($windowSize, getSize(), requestAnimationFrame);
  };

  window.addEventListener('resize', listener, PASSIVE);

  window.addEventListener('orientationchange', listener, PASSIVE);
}

/**
 * Control of the window's inner size, kept in sync with `resize` and
 * `orientationchange` (committed once per animation frame). `width`/`height`
 * are nested controls — subscribe to one without re-rendering on the other.
 */
export default $windowSize as ReadonlyControlScope<Size>;
