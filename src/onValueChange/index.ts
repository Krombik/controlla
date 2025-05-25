import noop from 'lodash.noop';
import type { AsyncState, ReadonlyState } from '../types';
import { postBatchCallbacksPush } from '../utils/batching';
import { ROOT } from '../utils/constants';

const onValueChange = ((
  state: ReadonlyState | ReadonlyState[],
  cb: (values?: any[]) => void
): (() => void) => {
  if (Array.isArray(state)) {
    let isAvailable = true;

    const l = state.length;

    const unlisteners: Array<() => void> = Array(l);

    if (cb.length) {
      const values = Array(l);

      for (let i = 0; i < l; i++) {
        const utils = state[i][ROOT];

        values[i] = utils._get();

        unlisteners[i] = utils._onValueChange((value) => {
          values[i] = value;

          if (isAvailable) {
            isAvailable = false;

            postBatchCallbacksPush(() => {
              cb(values);

              isAvailable = true;
            });
          }
        });
      }
    } else {
      const fn = () => {
        if (isAvailable) {
          isAvailable = false;

          postBatchCallbacksPush(() => {
            cb();

            isAvailable = true;
          });
        }
      };

      for (let i = 0; i < l; i++) {
        unlisteners[i] = state[i][ROOT]._onValueChange(fn);
      }
    }

    return () => {
      cb = noop;

      for (let i = 0; i < l; i++) {
        unlisteners[i]();
      }
    };
  }

  return state[ROOT]._onValueChange(cb);
}) as {
  /**
   * Registers a callback to be invoked when the value of a single {@link state} changes.
   *
   * @param state - The state to monitor for changes.
   * @param cb - The callback function invoked with the new value of the state.
   * @returns a function to unsubscribe from the value change event.
   *
   */
  <T>(state: AsyncState<T>, cb: (value: T | undefined) => void): () => void;
  /**
   * Registers a callback to be invoked when the value of a single {@link state} changes.
   *
   * @param state - The state to monitor for changes.
   * @param cb - The callback function invoked with the new value of the state.
   * @returns a function to unsubscribe from the value change event.
   *
   */
  <T>(state: ReadonlyState<T>, cb: (value: T) => void): () => void;
  /**
   * Registers a callback to be invoked when the values of multiple {@link states} change.
   *
   * @param states - The states to monitor for changes.
   * @param cb - The callback function invoked with the new values of the states.
   * @returns a function to unsubscribe from the values change event.
   */
  <const S extends ReadonlyState[]>(
    states: S,
    cb: (values: {
      [index in keyof S]: S[index] extends ReadonlyState<infer K>
        ? K | (S[index] extends AsyncState ? undefined : never)
        : never;
    }) => void
  ): () => void;
};

export default onValueChange;
