import type { ValueChangeCallbacks } from '../types';
import { RESOLVED_PROMISE } from './constants';
import executeSetters from './executeSetters';

const setsQueue: ValueChangeCallbacks[] = [];

const valuesQueue: any[] = [];

const postBatchCallbacks: Array<() => void> = [];

let batchInPending = true;

export const scheduleBatch = () => {
  if (batchInPending) {
    batchInPending = false;

    RESOLVED_PROMISE.then(() => {
      do {
        for (let i = 0; i < setsQueue.length; i++) {
          executeSetters(setsQueue[i], valuesQueue[i]);
        }

        setsQueue.length = 0;

        valuesQueue.length = 0;

        for (let i = 0; i < postBatchCallbacks.length; i++) {
          postBatchCallbacks[i]();
        }

        postBatchCallbacks.length = 0;
      } while (setsQueue.length);

      batchInPending = true;
    });
  }
};

export const addToBatch = (set: ValueChangeCallbacks, value: any) => {
  setsQueue.push(set);

  valuesQueue.push(value);

  scheduleBatch();
};

export const postBatchCallbacksPush =
  postBatchCallbacks.push.bind(postBatchCallbacks);
