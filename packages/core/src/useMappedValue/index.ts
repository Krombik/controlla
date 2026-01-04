import { useCallback, useSyncExternalStore } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { ROOT } from '#shared/constants';
import { postBatchCallbacksPush } from '#shared/batching';
import noop from 'lodash.noop';
import type { AnyAsyncControl } from '#_types';

const useMappedValue = ((
  control: AnyAsyncControl,
  mapper: (value: any, isLoaded?: boolean, error?: any) => any
) => {
  const utils = control[ROOT];

  const l = mapper.length;

  if (l < 2) {
    return useSyncExternalStore(
      utils._subscribeWithLoad || utils._subscribe,
      () => mapper(utils._get())
    );
  }

  const root = utils[ROOT];

  const isLoadedControl = root._isLoadedControl[ROOT];

  const errorControl = l > 2 && root._errorControl[ROOT];

  return useSyncExternalStore(
    useCallback(
      (cb) => {
        let isAvailable = true;

        const fn = () => {
          if (isAvailable) {
            isAvailable = false;

            postBatchCallbacksPush(() => {
              cb();

              isAvailable = true;
            });
          }
        };

        const unlistenValue = (utils._subscribeWithLoad || utils._subscribe)(
          fn
        );

        const unlistenIsLoaded = isLoadedControl._subscribe(fn);

        const unlistenError = errorControl ? errorControl._subscribe(fn) : noop;

        return () => {
          unlistenValue();

          unlistenIsLoaded();

          unlistenError();

          cb = noop;
        };
      },
      [utils]
    ),
    () =>
      mapper(
        utils._get(),
        isLoadedControl._value,
        errorControl && errorControl._value
      )
  );
}) as {
  /**
   * Hook to {@link mapper map} and retrieve a value from a {@link control}.
   * @param mapper - Function that maps the value.
   */
  <T, V, E = any>(
    control: ReadonlyAsyncControl<T, E>,
    mapper: (value: T | undefined, isLoaded: boolean, error: E | undefined) => V
  ): V;
  /**
   * Hook to {@link mapper map} and retrieve a value from a {@link control}.
   * @param mapper - Function that maps the value.
   */
  <T, V>(control: ReadonlyControl<T>, mapper: (value: T) => V): V;
};

export default useMappedValue;
