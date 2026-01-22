import noop from 'lodash.noop';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { addAfterFlushHook } from '#utils/batching';
import { ROOT } from '#shared/constants';
import { OnValueChange } from '#_types';

const subscribe = ((
  control: ReadonlyControl | ReadonlyControl[],
  onChange: (values?: any[]) => void
): (() => void) => {
  if (Array.isArray(control)) {
    let isAvailable = true;

    const l = control.length;

    const unlisteners: Array<() => void> = Array(l);

    if (onChange.length) {
      const values = Array(l);

      for (let i = 0; i < l; i++) {
        const utils = control[i][ROOT];

        values[i] = utils._get();

        unlisteners[i] = utils._subscribe((value) => {
          values[i] = value;

          if (isAvailable) {
            isAvailable = false;

            addAfterFlushHook(() => {
              onChange(values);

              isAvailable = true;
            });
          }
        });
      }
    } else {
      const fn = () => {
        if (isAvailable) {
          isAvailable = false;

          addAfterFlushHook(() => {
            onChange();

            isAvailable = true;
          });
        }
      };

      for (let i = 0; i < l; i++) {
        unlisteners[i] = control[i][ROOT]._subscribe(fn);
      }
    }

    return () => {
      onChange = noop;

      for (let i = 0; i < l; i++) {
        unlisteners[i]();
      }
    };
  }

  return control[ROOT]._subscribe(onChange, true);
}) as {
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
    onChanged: OnValueChange<T | undefined>
  ): () => void;
  /**
   * Registers a callback to be invoked when the value of a single {@link control} changes.
   *
   * @param control - The control to monitor for changes.
   * @param onChange - The callback function invoked with the new value of the control.
   * @returns a function to unsubscribe from the value change event.
   *
   */
  <T>(control: ReadonlyControl<T>, onChanged: OnValueChange<T>): () => void;
  /**
   * Registers a callback to be invoked when the values of multiple {@link controls} change.
   *
   * @param controls - The controls to monitor for changes.
   * @param onChange - The callback function invoked with the new values of the controls.
   * @returns a function to unsubscribe from the values change event.
   */
  <const S extends ReadonlyControl[]>(
    controls: S,
    onChange: (values: {
      [index in keyof S]: S[index] extends ReadonlyControl<infer K>
        ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
        : never;
    }) => void
  ): () => void;
};

export default subscribe;
