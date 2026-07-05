import type {
  AsyncControlInternals,
  ChangeListener,
  Lane,
  Notifier,
} from '#internal/types';
import settlePromise from '#internal/settlePromise';
import { notify } from '#internal/flushQueue';

type StatusInternals = {
  _value: any;
  readonly _listeners: ChangeListener[];
  readonly _dependents: Notifier[];
};

/**
 * Sets a status control value (loading/ready) and notifies on change.
 * Mutates the passed internals in place — allocates nothing.
 */
export const commitStatusValue = (
  internals: StatusInternals,
  nextValue: any,
  lane: Lane
) => {
  const prevValue = internals._value;

  if (nextValue !== prevValue) {
    internals._value = nextValue;

    notify(
      internals._listeners,
      internals._dependents,
      lane,
      nextValue,
      prevValue
    );
  }
};

/**
 * Sets an error control value, notifies on change and settles the pending
 * promise (if any). Mutates the passed internals in place — allocates nothing.
 */
export const commitErrorValue = (
  root: Pick<AsyncControlInternals, '_value' | '_promise'>,
  internals: StatusInternals,
  nextError: any,
  lane: Lane
) => {
  const prevError = internals._value;

  if (nextError !== prevError) {
    internals._value = nextError;

    notify(
      internals._listeners,
      internals._dependents,
      lane,
      nextError,
      prevError
    );

    if (nextError !== undefined) {
      settlePromise(root, false, nextError);
    }
  }
};
