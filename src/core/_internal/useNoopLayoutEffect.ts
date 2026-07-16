import { useLayoutEffect } from 'react';
import noop from 'lodash.noop';

const DEPS = [0];

const useNoopLayoutEffect = () => {
  useLayoutEffect(noop, DEPS);
};

export default useNoopLayoutEffect;
