import load from '../load';
import type { AnyAsyncControl, LoadableControl } from '../types';

const handleUnlisteners = (
  valueUnlistener: () => void,
  control: AnyAsyncControl
) => {
  const loadUnlistener: undefined | (() => void) = load(
    control as LoadableControl
  );

  return loadUnlistener
    ? () => {
        valueUnlistener();

        loadUnlistener();
      }
    : valueUnlistener;
};

export default handleUnlisteners;
