import { useLayoutEffect } from 'react';
import type { ControlInternalsChild } from '#internal/types';

const useInternalsValue = (
  internals: ControlInternalsChild,
  forceRerender: () => void
) => {
  const value = internals._get();

  useLayoutEffect(() => {
    const root = internals._root;

    root._attach(internals, forceRerender, true);

    if (value !== internals._get()) {
      forceRerender();
    }

    return () => {
      root._detach(internals, forceRerender, true);
    };
  }, [internals]);

  return value;
};

export default useInternalsValue;
