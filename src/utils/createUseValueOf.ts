import { useLayoutEffect, useState } from 'react';
import useNoop from './useNoop';

import type { Falsy, _SimplifiedState } from '../types';
import type createOnValueOfChange from './createOnValueOfChange';
import type createGetValueOf from './createGetValueOf';

const createUseValueOf =
  (
    onValueChanged: ReturnType<typeof createOnValueOfChange>,
    getValue: ReturnType<typeof createGetValueOf>
  ) =>
  (state: _SimplifiedState | Falsy) => {
    if (state) {
      const t = useState<{}>();

      useLayoutEffect(() => {
        const forceRerender = t[1];

        return onValueChanged(state, () => {
          forceRerender({});
        });
      }, [state.r, 0]);

      return getValue(state);
    }

    useNoop();
  };

export default createUseValueOf;
