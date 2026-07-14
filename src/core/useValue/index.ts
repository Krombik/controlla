import type { Falsy } from '#internal/types';
import { INTERNALS } from '#internal/constants';
import type {
  AsyncControl,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';
import useForceRerender from '#internal/useForceRerender';
import useNoopLayoutEffect from '#internal/useNoopLayoutEffect';
import useInternalsValue from '#internal/useInternalsValue';

const useValue = ((control: AsyncControl | Falsy) => {
  const forceRerender = useForceRerender();

  if (control) {
    return useInternalsValue(control[INTERNALS], forceRerender);
  }

  useNoopLayoutEffect();
}) as {
  /**
   * Returns the current value of the given {@link control}, rerendering the
   * component whenever it changes. For an async control the value is
   * `undefined` until ready; using the hook starts the loading. The
   * {@link control} may be falsy — the hook returns `undefined`.
   *
   * @example
   * ```tsx
   * const user = useValue($user);
   * ```
   */
  <S extends ReadonlyControl | Falsy>(
    control: S
  ): S extends ReadonlyControl<infer K>
    ? K | (S extends ReadonlyAsyncControl ? undefined : never)
    : undefined;
};

export default useValue;
