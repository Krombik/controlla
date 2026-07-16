import { useLayoutEffect } from 'react';
import type {
  ControlInternalsChild,
  PrimitiveControlInternals,
} from '#internal/types';

const useInternalsValue = (
  internals: ControlInternalsChild | PrimitiveControlInternals,
  forceRerender: () => void
) => {
  const value = internals._get();

  useLayoutEffect(() => {
    const root = internals._root;

    root._attach(internals, forceRerender, true);

    // the value may have changed between render and subscription
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
