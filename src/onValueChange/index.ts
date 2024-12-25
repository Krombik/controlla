import noop from 'lodash.noop';
import type { HandlePending, StateBase as State } from '../types';
import { postBatchCallbacksPush } from '../utils/batching';

const onValueChange = ((
  state: State | State[],
  cb: (values?: any[]) => void
): (() => void) => {
  if ('length' in state) {
    let isAvailable = true;

    const l = state.length;

    const unlisteners: Array<() => void> = new Array(l);

    if (cb.length) {
      const values = state.map((state) => state.get());

      for (let i = 0; i < l; i++) {
        const item = state[i];

        unlisteners[i] = item._onValueChange((value) => {
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
        const item = state[i];

        unlisteners[i] = item._onValueChange(fn);
      }
    }

    return () => {
      cb = noop;

      for (let i = 0; i < l; i++) {
        unlisteners[i]();
      }
    };
  }

  return state._onValueChange(cb);
}) as {
  /**
   * Registers a callback to be invoked when the value of a single {@link state} changes.
   *
   * @param state - The state to monitor for changes.
   * @param cb - The callback function invoked with the new value of the state.
   * @returns a function to unsubscribe from the value change event.
   *
   */
  <T>(state: State<T>, cb: (value: HandlePending<T>) => void): () => void;
  /**
   * Registers a callback to be invoked when the values of multiple {@link states} change.
   *
   * @param states - The states to monitor for changes.
   * @param cb - The callback function invoked with the new values of the states.
   * @returns a function to unsubscribe from the values change event.
   */
  <const S extends State[]>(
    states: S,
    cb: (values: {
      [index in keyof S]: HandlePending<
        S[index] extends State<infer K> ? K : never
      >;
    }) => void
  ): () => void;
};

export default onValueChange;
