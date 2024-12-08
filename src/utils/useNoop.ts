import noop from 'lodash.noop';
import { useLayoutEffect } from 'react';
import useForceRerender from 'react-helpful-utils/useForceRerender';

const useNoop = () => {
  useForceRerender();

  useLayoutEffect(noop, [0]);
};

export default useNoop;
