import type { AsyncRootNode } from '#internal/types';

export const handleUnload = (data: AsyncRootNode) => {
  if (data._cleanup) {
    data._cleanup = data._cleanup();
  }
};

export const handleSlowLoading = (
  slowLoading: AsyncRootNode['_slowLoadMonitor'],
  isLoading: boolean
) => {
  if (slowLoading) {
    clearTimeout(slowLoading._timerId);

    slowLoading._timerId = isLoading
      ? setTimeout(() => {
          const callbacks = slowLoading._listeners;

          for (let i = 0; i < callbacks.length; i++) {
            callbacks[i]();
          }
        }, slowLoading._timeoutMs)
      : undefined;
  }
};
