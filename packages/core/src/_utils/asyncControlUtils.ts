import type { AsyncControlRoot } from '#_types';

export const handleUnload = (data: AsyncControlRoot) => {
  if (data._unload) {
    data._unload = data._unload();
  }
};

export const handleSlowLoading = (
  slowLoading: AsyncControlRoot['_slowLoading'],
  isLoaded: boolean
) => {
  if (slowLoading) {
    clearTimeout(slowLoading._timeoutId);

    slowLoading._timeoutId = isLoaded
      ? undefined
      : setTimeout(() => {
          const callbacks = slowLoading._callbacks;

          for (let i = 0; i < callbacks.length; i++) {
            callbacks[i]();
          }
        }, slowLoading._timeout);
  }
};
