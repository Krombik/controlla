import noop from 'lodash.noop';
import getValue from '../getValue';
import type { State, HandlePending } from '../types';
import { postBatchCallbacksPush } from '../utils/batching';

const onValueChange: {
  <T>(state: State<T>, cb: (value: HandlePending<T>) => void): () => void;
  <const S extends State<any>[]>(
    states: S,
    cb: (
      ...values: {
        [index in keyof S]: HandlePending<
          S[index] extends State<infer K> ? K : never
        >;
      }
    ) => void
  ): () => void;
} = (state: State | State[], cb: (...values: any[]) => void): (() => void) => {
  if ('length' in state) {
    let isAvailable = true;

    const unlisteners: Array<() => void> = [];

    const values: any[] = [];

    const fn = () => {
      if (isAvailable) {
        isAvailable = false;

        postBatchCallbacksPush(() => {
          cb(...state.map(getValue));

          isAvailable = true;
        });
      }
    };

    for (let i = 0; i < state.length; i++) {
      const item = state[i];

      values.push(getValue(item));

      unlisteners.push(item._internal._onValueChange(fn, item._path!));
    }

    return () => {
      cb = noop;

      for (let i = 0; i < unlisteners.length; i++) {
        unlisteners[i]();
      }
    };
  }

  return state._internal._onValueChange(cb, state._path!);
};

export default onValueChange;
