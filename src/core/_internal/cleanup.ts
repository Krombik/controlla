import noop from '#internal/noop';
import type { ControlInternalsBase } from '#internal/types';

/**
 * The scope collecting the cleanups of everything created right now, set by
 * the hooks around a creation instead of threaded through it - a control
 * doesn't know a scope exists, and every kind of it reports the same way.
 */
export const cleanupScope: { _value: Array<() => void> | null } = {
  _value: null,
};

export const gcRegistry: FinalizationRegistry<() => void> =
  typeof FinalizationRegistry != 'undefined'
    ? new FinalizationRegistry<() => void>((cleanup) => {
        cleanup();
      })
    : ({ register: noop } as Partial<
        FinalizationRegistry<any>
      > as FinalizationRegistry<any>);

/**
 * Files a control's teardown with both sinks: collection, and the enclosing
 * {@link cleanupScope scope} when there is one - which runs it as soon as the
 * scope is gone instead of waiting for the control to be collected.
 */
export const registerCleanup = (
  target: ControlInternalsBase,
  cleanup: () => void
) => {
  const scope = cleanupScope._value;

  gcRegistry.register(target, cleanup);

  if (scope) {
    scope.push(cleanup);
  }
};
