import type { ChangeListener } from '#internal/types';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';

const onValueChange: {
  /**
   * Registers a callback invoked with the new and previous value whenever the
   * given {@link control}'s value changes. A plain listener — it doesn't
   * trigger loading of a loadable control.
   *
   * @returns a function to remove the callback.
   *
   * @example
   * ```ts
   * const unsubscribe = onValueChange($user, (user, prevUser) => {
   *   console.log(user, prevUser);
   * });
   * ```
   */
  <T>(
    control: ReadonlyAsyncControl<T>,
    onChange: ChangeListener<T | undefined>
  ): () => void;
  /**
   * Registers a callback invoked with the new and previous value whenever the
   * given {@link control}'s value changes.
   *
   * @returns a function to remove the callback.
   */
  <T>(control: ReadonlyControl<T>, onChange: ChangeListener<T>): () => void;
} = (control, onChange) => {
  const internals = control[INTERNALS];

  const root = internals._root;

  root._attach(internals, onChange, false);

  return () => {
    root._detach(internals, onChange, false);
  };
};

export default onValueChange;
