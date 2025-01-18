import type { State } from '../types';
import { RESOLVED_PROMISE } from './constants';
import executeSetters from './executeSetters';

const beforeBatchCallbacks: Array<() => void> = [];

const postBatchCallbacks: Array<() => void> = [];

let batchMap = new Map<State, any>();

let batchInPending = true;

export const scheduleBatch = () => {
  if (batchInPending) {
    batchInPending = false;

    RESOLVED_PROMISE.then(() => {
      for (let i = 0; i < beforeBatchCallbacks.length; i++) {
        beforeBatchCallbacks[i]();
      }

      beforeBatchCallbacks.length = 0;

      const currMap = batchMap;

      batchMap = new Map();

      const it = currMap.keys();

      const next = it.next.bind(it);

      for (let i = currMap.size; i--; ) {
        const state: State = next().value;

        state._valueToggler = (state._valueToggler ^ 1) as 0 | 1;

        if (state._callbacks.size) {
          executeSetters(state._callbacks, currMap.get(state));
        }
      }

      for (let i = 0; i < postBatchCallbacks.length; i++) {
        postBatchCallbacks[i]();
      }

      postBatchCallbacks.length = 0;

      batchInPending = true;

      if (beforeBatchCallbacks.length || batchMap.size) {
        scheduleBatch();
      }
    });
  }
};

export const addToBatch = (state: State, value: any) => {
  batchMap.set(state, value);

  scheduleBatch();
};

export const beforeBatchCallbacksPush =
  beforeBatchCallbacks.push.bind(beforeBatchCallbacks);

export const postBatchCallbacksPush =
  postBatchCallbacks.push.bind(postBatchCallbacks);
