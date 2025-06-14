import type { InternalAsyncControl } from '../types';
import executeSetters from './executeSetters';

export const handleUnload = (data: InternalAsyncControl) => {
  if (data._unload) {
    data._unload = data._unload();
  }
};

export const handleSlowLoading = (
  slowLoading: InternalAsyncControl['_slowLoading'],
  isLoaded: boolean
) => {
  if (slowLoading) {
    clearTimeout(slowLoading._timeoutId);

    slowLoading._timeoutId = isLoaded
      ? undefined
      : setTimeout(() => {
          executeSetters(slowLoading._callbacks);
        }, slowLoading._timeout);
  }
};
