import type { Control, SyncExternalStorage } from '#types';
import { useRef } from 'react';
import type { Subscription } from '#internal/types';
import { cleanupScope } from '#internal/cleanup';
import { EMPTY_ARR } from '#internal/constants';
import useSubscription from '#internal/useSubscription';

const makeUseControl =
  (
    createControl: (
      arg1?: any,
      externalStorage?: SyncExternalStorage
    ) => Control,
    withoutLazyArg: boolean
  ) =>
  (arg1?: any, externalStorage?: SyncExternalStorage): any => {
    const ref = useRef<[Control, Subscription] | null>(null);

    let item = ref.current;

    if (item === null) {
      const scope = (cleanupScope._value = []);
      try {
        ref.current = item = [
          createControl(
            withoutLazyArg || typeof arg1 != 'function' ? arg1 : arg1(),
            externalStorage
          ),
          scope[0],
        ];
      } finally {
        cleanupScope._value = null;
      }
    }

    const subscription = item[1];

    if (subscription) {
      useSubscription(subscription, EMPTY_ARR);
    }

    return item[0];
  };

export default makeUseControl;
