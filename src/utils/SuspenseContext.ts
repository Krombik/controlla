import { createContext } from 'react';
import type { StateInternalUtils } from '../types';

const SuspenseContext = createContext<Map<
  StateInternalUtils,
  () => void
> | null>(null);

export default SuspenseContext;
