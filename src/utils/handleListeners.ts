import { Falsy } from '../types';

const handleListeners = (unlisteners: Array<(() => void) | Falsy>) => {
  unlisteners = unlisteners.filter(Boolean) as Array<() => void>;

  const l = unlisteners.length;

  return l
    ? l > 1
      ? () => {
          for (let i = 0; i < l; i++) {
            (unlisteners[i] as () => void)();
          }
        }
      : (unlisteners[0] as () => void)
    : undefined;
};

export default handleListeners;
