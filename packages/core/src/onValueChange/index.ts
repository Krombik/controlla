import type { ChangeListener } from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';

const onValueChange: {
  /**
   * Registers a callback to be invoked when the value of a single {@link control} changes.
   *
   * @param control - The control to monitor for changes.
   * @param onChange - The callback function invoked with the new value of the control.
   * @returns a function to unsubscribe from the value change event.
   *
   */
  <T>(
    control: ReadonlyAsyncControl<T>,
    onChange: ChangeListener<T | undefined>
  ): () => void;
  /**
   * Registers a callback to be invoked when the value of a single {@link control} changes.
   *
   * @param control - The control to monitor for changes.
   * @param onChange - The callback function invoked with the new value of the control.
   * @returns a function to unsubscribe from the value change event.
   *
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
