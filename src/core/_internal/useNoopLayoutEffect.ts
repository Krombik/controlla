import { useLayoutEffect } from 'react';
import noop from 'lodash.noop';

const DEPS = [0];

/**
 * A filler layout-effect slot — keeps a hook count render-stable without
 * allocating a deps array per render.
 */
const useNoopLayoutEffect = () => {
  useLayoutEffect(noop, DEPS);
};

export default useNoopLayoutEffect;
