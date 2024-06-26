import noop from 'lodash.noop';
import { useLayoutEffect, useState } from 'react';

const useNoop = () => {
  useState();

  useLayoutEffect(noop, [0, 0]);
};

export default useNoop;
