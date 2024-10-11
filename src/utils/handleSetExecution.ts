import { ValueChangeCallbacks } from '../types';
import { RESOLVED_PROMISE } from './constants';
import executeSetters from './executeSetters';

const setsQueue: ValueChangeCallbacks[] = [];

const argsQueue: any[] = [];

let isAvailable = true;

const handleSetExecution = (set: ValueChangeCallbacks, value: any) => {
  setsQueue.push(set);

  argsQueue.push(value);

  if (isAvailable) {
    isAvailable = false;

    RESOLVED_PROMISE.then(() => {
      const l = setsQueue.length;

      for (let i = 0; i < l; i++) {
        executeSetters(setsQueue[i], argsQueue[i]);
      }

      setsQueue.length = 0;

      argsQueue.length = 0;

      isAvailable = true;
    });
  }
};

export default handleSetExecution;
